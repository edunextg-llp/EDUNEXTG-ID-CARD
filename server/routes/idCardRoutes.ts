import { Router } from "express";
import { and, asc, desc, eq, inArray, isNull, like, ne, or } from "drizzle-orm";
import {
  approvalHistory,
  auditLogs,
  idCardData,
  idCardFiles,
  idCardRequests,
  idCards,
  idCardTemplates,
  schools,
  schoolTemplates,
  templateElements,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  adminRoles,
  audit,
  canReadSchool,
  currentUser,
  fail,
  generateCardNumber,
  normalizeTemplateElement,
  notify,
  requireRole,
} from "./shared";

const router = Router();
router.get("/id-cards", async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const whereConditions: any[] = [isNull(idCards.removedAt)];

    if (adminRoles.has(user.role)) {
      if (req.query.schoolId) {
        whereConditions.push(eq(idCards.schoolId, Number(req.query.schoolId)));
      }
    } else {
      if (!user.schoolId) return res.json([]);
      whereConditions.push(eq(idCards.schoolId, user.schoolId));
    }

    if (req.query.status && req.query.status !== "All") {
      whereConditions.push(eq(idCards.status, String(req.query.status) as any));
    }

    const qStr = req.query.q ? String(req.query.q).trim() : "";
    if (qStr) {
      const qPattern = '%' + qStr + '%';
      const matchingNameCards = await db
        .select({ idCardId: idCardData.idCardId })
        .from(idCardData)
        .where(
          and(
            or(eq(idCardData.fieldKey, "student_name"), eq(idCardData.fieldKey, "studentName")),
            like(idCardData.fieldValue, qPattern),
          ),
        );
      const nameCardIds = matchingNameCards.map((r) => r.idCardId);

      const searchOr = [
        like(idCards.cardNumber, qPattern),
        like(schools.name, qPattern),
      ];
      if (nameCardIds.length > 0) {
        searchOr.push(inArray(idCards.id, nameCardIds));
      }
      whereConditions.push(or(...searchOr)!);
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = req.query.all === "true" || req.query.limit === "all"
      ? 1000
      : Math.min(100, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    const cardsList = await db
      .select({
        id: idCards.id,
        schoolId: idCards.schoolId,
        templateId: idCards.templateId,
        requestId: idCards.requestId,
        cardNumber: idCards.cardNumber,
        status: idCards.status,
        submittedByUserId: idCards.submittedByUserId,
        approvedByUserId: idCards.approvedByUserId,
        printedAt: idCards.printedAt,
        createdAt: idCards.createdAt,
        updatedAt: idCards.updatedAt,
        schoolName: schools.name,
        templateName: idCardTemplates.name,
      })
      .from(idCards)
      .leftJoin(schools, eq(idCards.schoolId, schools.id))
      .leftJoin(idCardTemplates, eq(idCards.templateId, idCardTemplates.id))
      .where(whereClause)
      .orderBy(desc(idCards.createdAt))
      .limit(limit)
      .offset(offset);

    // Attach studentName from id_card_data if available
    const cardIds = cardsList.map((c) => c.id);
    let allData: Array<{ idCardId: number; fieldKey: string; fieldValue: string | null }> = [];
    if (cardIds.length > 0) {
      allData = await db
        .select({
          idCardId: idCardData.idCardId,
          fieldKey: idCardData.fieldKey,
          fieldValue: idCardData.fieldValue,
        })
        .from(idCardData)
        .where(inArray(idCardData.idCardId, cardIds));
    }

    const dataByCardId = new Map<number, Record<string, string>>();
    for (const d of allData) {
      const map = dataByCardId.get(d.idCardId) ?? {};
      const val = d.fieldValue || "";
      // Separate metadata from full base64 images in list responses
      const isHeavy =
        d.fieldKey === "photo" ||
        d.fieldKey === "student_photo" ||
        d.fieldKey === "signature" ||
        d.fieldKey === "logo" ||
        val.startsWith("data:image/") ||
        val.length > 500;

      map[d.fieldKey] = isHeavy ? "[IMAGE_ATTACHED]" : val;
      dataByCardId.set(d.idCardId, map);
    }

    const results = cardsList.map((c) => {
      const dataMap = dataByCardId.get(c.id) ?? {};
      const studentName = dataMap["student_name"] || dataMap["studentName"] || "Student";
      return {
        ...c,
        studentName,
        dataMap,
      };
    });

    res.json(results);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Anti-spoofing: Non-super-admins strictly use user.schoolId
    const schoolId = adminRoles.has(user.role)
      ? Number(req.body.schoolId || user.schoolId)
      : user.schoolId;

    if (!schoolId) return res.status(400).json({ error: "schoolId is required" });

    // Validate school exists
    const school = (await db.select().from(schools).where(eq(schools.id, schoolId)))[0];
    if (!school) return res.status(404).json({ error: `School with ID ${schoolId} not found` });

    // Identify template: explicit or school locked / default
    let templateId = Number(req.body.templateId);
    if (!templateId) {
      const schoolTmpl =
        (await db.select().from(schoolTemplates).where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isLocked, true))))[0] ||
        (await db.select().from(schoolTemplates).where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isDefault, true))))[0];
      templateId = schoolTmpl?.templateId ?? (await db.select().from(idCardTemplates).where(eq(idCardTemplates.status, "ACTIVE")).limit(1))[0]?.id;
    }

    if (!templateId) {
      return res.status(400).json({ error: "No active template available for this school" });
    }

    // Generate or use persistent card number
    const cardNumber = req.body.cardNumber && String(req.body.cardNumber).trim()
      ? String(req.body.cardNumber).trim()
      : await generateCardNumber(schoolId);

    // Validate card number uniqueness for this school
    const existingCard = (
      await db
        .select({ id: idCards.id })
        .from(idCards)
        .where(and(eq(idCards.schoolId, schoolId), eq(idCards.cardNumber, cardNumber)))
    )[0];
    if (existingCard) {
      return res.status(400).json({ error: `Card number '${cardNumber}' already exists in this school` });
    }

    const r = await db.insert(idCards).values({
      schoolId,
      templateId,
      cardNumber,
      status: "DRAFT",
      submittedByUserId: user.id,
    });
    const id = Number(r[0].insertId);

    // Save dynamic fields to id_card_data
    if (req.body.data && typeof req.body.data === "object") {
      for (const [fieldKey, fieldValue] of Object.entries(req.body.data)) {
        if (fieldValue !== undefined && fieldValue !== null) {
          await db.insert(idCardData).values({
            idCardId: id,
            fieldKey,
            fieldValue: String(fieldValue),
          });
        }
      }
    }

    // Save photo file metadata if provided
    const photoUrl = req.body.data?.photo || req.body.photoUrl;
    if (photoUrl) {
      if (typeof photoUrl === "string" && photoUrl.startsWith("data:")) {
        const b64 = photoUrl.includes(",") ? photoUrl.split(",")[1] : photoUrl;
        const approxBytes = Math.floor((b64.length * 3) / 4);
        if (approxBytes > 300 * 1024) {
          return res.status(400).json({ error: "Card photo exceeds 300KB size limit" });
        }
      }
      await db.insert(idCardFiles).values({
        idCardId: id,
        fileType: "PHOTO",
        fileName: req.body.photoFileName || "student_photo.png",
        fileUrl: photoUrl,
        mimeType: "image/png",
        fileSize: null,
        uploadedByUserId: user.id,
      });
    }

    // Save signature file metadata if provided
    const signatureUrl = req.body.data?.signature || req.body.signatureUrl;
    if (signatureUrl) {
      await db.insert(idCardFiles).values({
        idCardId: id,
        fileType: "SIGNATURE",
        fileName: req.body.signatureFileName || "signature.png",
        fileUrl: signatureUrl,
        mimeType: "image/png",
        fileSize: null,
        uploadedByUserId: user.id,
      });
    }

    await audit(user, "CREATE_ID_CARD", "id_card", id, schoolId, { cardNumber, templateId });
    const created = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    res.status(201).json(created);
  } catch (e) {
    fail(res, e);
  }
});

router.get("/id-cards/:id", async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid card ID" });

    // Look up by idCards.id first
    let card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];

    // If not found by card ID, check if id is a requestId
    let requestRow = null;
    if (!card) {
      card = (await db.select().from(idCards).where(eq(idCards.requestId, id)))[0];
      if (!card) {
        requestRow = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, id)))[0];
        if (requestRow) {
          card = (
            await db
              .select()
              .from(idCards)
              .where(
                and(
                  eq(idCards.schoolId, requestRow.schoolId),
                  eq(idCards.cardNumber, requestRow.admissionCode),
                ),
              )
          )[0];
        }
      }
    }

    if (!card && !requestRow) return res.status(404).json({ error: "ID card not found" });

    const schoolId = card ? card.schoolId : requestRow!.schoolId;
    if (!canReadSchool(user, schoolId)) return res.status(403).json({ error: "ID card access denied" });

    const school = (await db.select().from(schools).where(eq(schools.id, schoolId)))[0];

    const templateId = card ? card.templateId : (requestRow?.templateId || null);
    const template = templateId
      ? (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, templateId)))[0]
      : null;
    const elements = template
      ? (await db.select().from(templateElements).where(eq(templateElements.templateId, template.id))).map(normalizeTemplateElement)
      : [];

    let dataRows: any[] = [];
    let files: any[] = [];
    let history: any[] = [];

    if (card) {
      dataRows = await db.select().from(idCardData).where(eq(idCardData.idCardId, card.id));
      files = await db.select().from(idCardFiles).where(eq(idCardFiles.idCardId, card.id));
      history = await db
        .select({
          id: approvalHistory.id,
          idCardId: approvalHistory.idCardId,
          fromStatus: approvalHistory.fromStatus,
          toStatus: approvalHistory.toStatus,
          action: approvalHistory.action,
          comments: approvalHistory.comments,
          actedByUserId: approvalHistory.actedByUserId,
          createdAt: approvalHistory.createdAt,
          actorName: users.name,
          actorRole: users.role,
        })
        .from(approvalHistory)
        .leftJoin(users, eq(approvalHistory.actedByUserId, users.id))
        .where(eq(approvalHistory.idCardId, card.id))
        .orderBy(asc(approvalHistory.id));
    }

    const dataMap: Record<string, string> = {};
    for (const d of dataRows) {
      dataMap[d.fieldKey] = d.fieldValue || "";
    }

    const request = requestRow
      ? requestRow
      : card?.requestId
        ? (await db.select().from(idCardRequests).where(eq(idCardRequests.id, card.requestId)))[0]
        : (
            await db
              .select()
              .from(idCardRequests)
              .where(
                and(
                  eq(idCardRequests.schoolId, schoolId),
                  eq(idCardRequests.admissionCode, card?.cardNumber || ""),
                ),
              )
          )[0] || null;

    if (!dataMap["student_name"] && request?.studentName) {
      dataMap["student_name"] = request.studentName;
    }
    if (!dataMap["admission_number"]) {
      dataMap["admission_number"] = request?.admissionCode || card?.cardNumber || "";
    }
    if (!dataMap["school_name"] && school) {
      dataMap["school_name"] = school.name;
    }
    if (!dataMap["school_code"] && school) {
      dataMap["school_code"] = school.shortCode;
    }

    const studentName = dataMap["student_name"] || request?.studentName || "Student";
    const cardNumber = card?.cardNumber || request?.admissionCode || `REQ-${request?.id}`;
    const status = card?.status || request?.status || "SUBMITTED";

    res.json({
      ...(card || {}),
      id: card ? card.id : request!.id,
      cardId: card ? card.id : null,
      requestId: request ? request.id : null,
      schoolId,
      templateId: template?.id ?? templateId,
      cardNumber,
      studentName,
      schoolName: school?.name || "",
      templateName: template?.name || "",
      status,
      data: dataRows,
      dataMap,
      files,
      template: template ? { ...template, elements } : null,
      approvalHistory: history,
      request,
    });
  } catch (e) {
    fail(res, e);
  }
});

router.put("/id-cards/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid card ID" });
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card) return res.status(404).json({ error: "ID card not found" });

    // Persist card number — do NOT change on edit
    const updatePayload: Record<string, unknown> = {};
    if (req.body.templateId !== undefined) updatePayload.templateId = Number(req.body.templateId);

    if (Object.keys(updatePayload).length > 0) {
      await db.update(idCards).set(updatePayload).where(eq(idCards.id, id));
    }

    // Update dynamic fields: merge/upsert fields
    if (req.body.data && typeof req.body.data === "object") {
      for (const [fieldKey, fieldValue] of Object.entries(req.body.data)) {
        if (fieldValue !== undefined && fieldValue !== null) {
          const existingField = (await db.select().from(idCardData).where(and(eq(idCardData.idCardId, id), eq(idCardData.fieldKey, fieldKey))))[0];
          if (existingField) {
            await db.update(idCardData).set({ fieldValue: String(fieldValue) }).where(eq(idCardData.id, existingField.id));
          } else {
            await db.insert(idCardData).values({
              idCardId: id,
              fieldKey,
              fieldValue: String(fieldValue),
            });
          }
        }
      }
    }

    // Update photo/signature files if provided
    if (req.body.data?.photo || req.body.photoUrl) {
      const pUrl = req.body.data?.photo || req.body.photoUrl;
      if (typeof pUrl === "string" && pUrl.startsWith("data:")) {
        const b64 = pUrl.includes(",") ? pUrl.split(",")[1] : pUrl;
        const approxBytes = Math.floor((b64.length * 3) / 4);
        if (approxBytes > 300 * 1024) {
          return res.status(400).json({ error: "Card photo exceeds 300KB size limit" });
        }
      }
      const existingPhoto = (await db.select().from(idCardFiles).where(and(eq(idCardFiles.idCardId, id), eq(idCardFiles.fileType, "PHOTO"))))[0];
      if (existingPhoto) {
        await db.update(idCardFiles).set({ fileUrl: pUrl }).where(eq(idCardFiles.id, existingPhoto.id));
      } else {
        await db.insert(idCardFiles).values({
          idCardId: id,
          fileType: "PHOTO",
          fileName: "student_photo.png",
          fileUrl: pUrl,
          mimeType: "image/png",
          uploadedByUserId: user.id,
        });
      }
    }

    await audit(user, "UPDATE_ID_CARD", "id_card", id, card.schoolId, req.body);
    res.json({ success: true, id });
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/id-cards/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid card ID" });
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card) return res.status(404).json({ error: "ID card not found" });

    await db.delete(idCards).where(eq(idCards.id, id));
    await audit(user, "DELETE_ID_CARD", "id_card", id, card.schoolId);
    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

// ─── SUBMISSION & TRANSITIONS ──────────────────────────────────────────────
router.post("/id-cards/:id/submit", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const cardId = Number(req.params.id);
    if (!cardId || isNaN(cardId)) return res.status(400).json({ error: "Invalid card ID" });
    const card = (await db.select().from(idCards).where(eq(idCards.id, cardId)))[0];
    if (!card) return res.status(404).json({ error: "ID card not found" });

    // Allowed transition check (Admin submits or resubmits)
    if (card.status !== "DRAFT" && card.status !== "CHANGES_REQUIRED" && card.status !== "REJECTED") {
      return res.status(400).json({ error: `Cannot submit card in ${card.status} status. Invalid transition.` });
    }

    // Validate template exists and dynamic requirements
    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, card.templateId)))[0];
    if (!template) return res.status(400).json({ error: "Template no longer exists" });

    const elements = (await db.select().from(templateElements).where(eq(templateElements.templateId, template.id))).map(normalizeTemplateElement);
    const dataRows = await db.select().from(idCardData).where(eq(idCardData.idCardId, cardId));
    const dataMap: Record<string, string> = {};
    for (const d of dataRows) dataMap[d.fieldKey] = d.fieldValue || "";

    // Validate required dynamic fields
    for (const el of elements) {
      if (el.elementType === "DYNAMIC_FIELD") {
        const cfg = el.config as Record<string, any> | null;
        const fKey = cfg?.dynamicField;
        if (fKey && (!dataMap[fKey] || !dataMap[fKey].trim())) {
          return res.status(400).json({ error: `Missing required template field: ${fKey}` });
        }
      }
    }

    // Validate photo requirement
    const hasPhotoElement = elements.some((el) => el.elementType === "PHOTO");
    if (hasPhotoElement) {
      const cardFiles = await db
        .select()
        .from(idCardFiles)
        .where(and(eq(idCardFiles.idCardId, cardId), eq(idCardFiles.fileType, "PHOTO")));
      const hasPhoto =
        (dataMap["photo"] && dataMap["photo"].trim()) ||
        (dataMap["student_photo"] && dataMap["student_photo"].trim()) ||
        cardFiles.length > 0;
      if (!hasPhoto) {
        return res.status(400).json({ error: "Student photo is required by the template before submission" });
      }
    }

    const targetStatus = card.status === "CHANGES_REQUIRED" ? "RESUBMITTED" : "SUBMITTED";
    const action = card.status === "CHANGES_REQUIRED" ? "RESUBMIT_ID_CARD" : "SUBMIT_ID_CARD";

    const studentName = dataMap["student_name"] || dataMap["studentName"] || req.body.studentName || "Student";
    const admissionCode = dataMap["admission_number"] || card.cardNumber;

    let requestId = card.requestId;

    await db.transaction(async (tx) => {
      if (requestId) {
        await tx
          .update(idCardRequests)
          .set({
            studentName,
            status: targetStatus,
            submittedAt: new Date(),
            requestedByUserId: user.id,
          })
          .where(eq(idCardRequests.id, requestId));
      } else {
        // Check if a request already exists for this school and admissionCode
        const existingReq = (
          await tx
            .select()
            .from(idCardRequests)
            .where(
              and(
                eq(idCardRequests.schoolId, card.schoolId),
                eq(idCardRequests.admissionCode, admissionCode)
              )
            )
        )[0];

        if (existingReq) {
          // Check if another active card is currently linked to this request
          const otherCard = (
            await tx
              .select()
              .from(idCards)
              .where(
                and(
                  eq(idCards.requestId, existingReq.id),
                  ne(idCards.id, cardId),
                  inArray(idCards.status, ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PRINTED"])
                )
              )
          )[0];

          if (otherCard) {
            throw new Error(
              `An active ID card #${otherCard.cardNumber} with admission code '${admissionCode}' already exists (${otherCard.status})`
            );
          }

          // Re-use and update the existing request with the current card's details
          requestId = existingReq.id;
          await tx
            .update(idCardRequests)
            .set({
              studentName,
              status: targetStatus,
              submittedAt: new Date(),
              requestedByUserId: user.id,
              templateId: card.templateId,
            })
            .where(eq(idCardRequests.id, requestId));
          await tx.update(idCards).set({ requestId }).where(eq(idCards.id, cardId));
        } else {
          try {
            const result = await tx.insert(idCardRequests).values({
              studentName,
              admissionCode,
              schoolId: card.schoolId,
              status: targetStatus,
              requestedByUserId: user.id,
              templateId: card.templateId,
              submittedAt: new Date(),
            });
            requestId = Number(result[0].insertId);
            await tx.update(idCards).set({ requestId }).where(eq(idCards.id, cardId));
          } catch (err: any) {
            if (err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate entry") || err?.errno === 1062) {
              const conReq = (
                await tx
                  .select()
                  .from(idCardRequests)
                  .where(
                    and(
                      eq(idCardRequests.schoolId, card.schoolId),
                      eq(idCardRequests.admissionCode, admissionCode)
                    )
                  )
              )[0];
              if (conReq) {
                requestId = conReq.id;
                await tx
                  .update(idCardRequests)
                  .set({
                    studentName,
                    status: targetStatus,
                    submittedAt: new Date(),
                    requestedByUserId: user.id,
                    templateId: card.templateId,
                  })
                  .where(eq(idCardRequests.id, requestId));
                await tx.update(idCards).set({ requestId }).where(eq(idCards.id, cardId));
              } else {
                throw new Error(`A submission request for admission code '${admissionCode}' already exists for this school.`);
              }
            } else {
              throw err;
            }
          }
        }
      }

      await tx.update(idCards).set({ status: targetStatus, submittedByUserId: user.id, requestId }).where(eq(idCards.id, cardId));

      await tx.insert(approvalHistory).values({
        idCardId: cardId,
        fromStatus: card.status,
        toStatus: targetStatus,
        action,
        actedByUserId: user.id,
      });

      await tx.insert(auditLogs).values({
        userId: user.id > 0 ? user.id : null,
        schoolId: card.schoolId,
        action,
        entityType: "id_card",
        entityId: cardId,
        newValues: { requestId, status: targetStatus } as never,
      });
    });

    // Notify school users of submission by Admin
    const schoolUsers = await db.select({ id: users.id }).from(users).where(eq(users.schoolId, card.schoolId));
    for (const s of schoolUsers) {
      await notify(
        s.id,
        card.schoolId,
        action,
        `New ID Card for Approval: ${card.cardNumber}`,
        `${studentName}'s ID card was submitted by Admin for your review & approval`,
        "id_card",
        cardId,
      );
    }

    res.json({ success: true, requestId, status: targetStatus });
  } catch (e) {
    fail(res, e);
  }
});
export const idCardRoutes = router;
