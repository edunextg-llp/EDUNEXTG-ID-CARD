import { Router, type Request, type Response } from "express";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  approvalHistory,
  auditLogs,
  idCardData,
  idCardRequests,
  idCards,
  idCardTemplates,
  notifications,
  removedCardsHistory,
  schools,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { heavyOperationsLimiter } from "../_core/rateLimit";
import {
  adminRoles,
  audit,
  currentUser,
  fail,
  notify,
  requireRole,
  schoolManagerRoles,
} from "./shared";

const router = Router();
const listRouter = Router();

// ─── APPROVAL & REVIEW TRANSITIONS (SCHOOL APPROVES / REJECTS, ADMIN PRINTS) ──
async function transitionApproval(
  req: Request,
  res: Response,
  targetStatus: "UNDER_REVIEW" | "CHANGES_REQUIRED" | "RESUBMITTED" | "APPROVED" | "REJECTED",
  action: string,
  comment?: string,
) {
  const user = currentUser(res);
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Database not available" });
  const paramId = Number(req.params.id);
  if (!paramId || isNaN(paramId)) return res.status(400).json({ error: "Invalid ID" });

  const isApprovalsRoute = req.baseUrl?.includes("approvals") || req.originalUrl?.includes("/api/approvals");
  let request: any = null;
  let card: any = null;

  if (isApprovalsRoute) {
    request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, paramId)))[0];
    if (request) {
      card = (await db.select().from(idCards).where(
        or(
          eq(idCards.requestId, request.id),
          and(eq(idCards.schoolId, request.schoolId), eq(idCards.cardNumber, request.admissionCode)),
        ),
      ))[0];
    }
  } else {
    card = (await db.select().from(idCards).where(eq(idCards.id, paramId)))[0];
    if (card && card.requestId) {
      request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, card.requestId)))[0];
    }
  }

  if (!request && !card) {
    request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, paramId)))[0];
    card = (await db.select().from(idCards).where(eq(idCards.id, paramId)))[0];
    if (request && !card) {
      card = (await db.select().from(idCards).where(eq(idCards.requestId, request.id)))[0];
    } else if (card && !request && card.requestId) {
      request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, card.requestId)))[0];
    }
  }

  const schoolId = card?.schoolId ?? request?.schoolId;
  if (!schoolId) return res.status(404).json({ error: "Record not found" });

  const isCardSchool = user.schoolId !== null && user.schoolId === schoolId;
  const isSuperAdmin = adminRoles.has(user.role);

  // Cross-school data isolation check
  if (!isSuperAdmin && !isCardSchool) {
    return res.status(403).json({ error: "Access denied to ID card of another school" });
  }

  if (targetStatus === "RESUBMITTED" && !isSuperAdmin) {
    return res.status(403).json({ error: "Only administrators can resubmit cards" });
  }

  if (targetStatus === "CHANGES_REQUIRED" && !comment?.trim()) {
    return res.status(400).json({ error: "A comment is required when requesting changes" });
  }
  if (targetStatus === "REJECTED" && !comment?.trim()) {
    return res.status(400).json({ error: "A rejection reason is required when rejecting a card" });
  }

  const currentStatus = card?.status ?? request?.status ?? "DRAFT";

  // Idempotent success if already in target status (e.g. APPROVED to APPROVED)
  if (currentStatus === targetStatus) {
    await db.transaction(async (tx) => {
      if (request && request.status !== targetStatus) {
        await tx.update(idCardRequests).set({ status: targetStatus }).where(eq(idCardRequests.id, request.id));
      }
      if (card && card.status !== targetStatus) {
        await tx.update(idCards).set({ status: targetStatus }).where(eq(idCards.id, card.id));
      }
    });
    return res.json({ success: true, status: targetStatus, alreadyTransitioned: true });
  }

  // Strict transition validation
  if (targetStatus === "UNDER_REVIEW") {
    if (currentStatus !== "SUBMITTED" && currentStatus !== "RESUBMITTED") {
      return res.status(400).json({ error: `Cannot review card in ${currentStatus} status. Must be SUBMITTED or RESUBMITTED.` });
    }
  } else if (targetStatus === "APPROVED" || targetStatus === "CHANGES_REQUIRED" || targetStatus === "REJECTED") {
    if (currentStatus !== "UNDER_REVIEW" && currentStatus !== "SUBMITTED" && currentStatus !== "RESUBMITTED") {
      return res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${targetStatus}` });
    }
  } else if (targetStatus === "RESUBMITTED") {
    if (currentStatus !== "CHANGES_REQUIRED" && currentStatus !== "REJECTED") {
      return res.status(400).json({ error: `Cannot resubmit card in ${currentStatus} status. Must be CHANGES_REQUIRED or REJECTED.` });
    }
  }

  let studentName = request?.studentName;
  if (!studentName && card) {
    const [dataRow] = await db
      .select({ val: idCardData.fieldValue })
      .from(idCardData)
      .where(and(eq(idCardData.idCardId, card.id), inArray(idCardData.fieldKey, ["student_name", "studentName", "name", "full_name"])))
      .limit(1);
    if (dataRow?.val) studentName = dataRow.val;
  }

  await db.transaction(async (tx) => {
    if (request) {
      await tx
        .update(idCardRequests)
        .set({
          status: targetStatus,
          reviewNote: comment ?? (targetStatus === "APPROVED" ? null : request.reviewNote),
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          submittedAt: targetStatus === "RESUBMITTED" ? new Date() : request.submittedAt,
        })
        .where(eq(idCardRequests.id, request.id));
    }

    if (card) {
      await tx
        .update(idCards)
        .set({
          status: targetStatus,
          approvedByUserId: targetStatus === "APPROVED" ? user.id : card.approvedByUserId,
        })
        .where(eq(idCards.id, card.id));

      await tx.insert(approvalHistory).values({
        idCardId: card.id,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        action,
        comments: comment ?? null,
        actedByUserId: user.id,
      });

      await tx.insert(auditLogs).values({
        userId: user.id > 0 ? user.id : null,
        schoolId: card.schoolId,
        action,
        entityType: "id_card",
        entityId: card.id,
        newValues: {
          requestId: request?.id,
          cardNumber: card.cardNumber,
          studentName: studentName || request?.studentName || "Student",
          admissionCode: request?.admissionCode,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          comment,
          reason: comment,
        } as never,
      });
    } else if (request) {
      await tx.insert(auditLogs).values({
        userId: user.id > 0 ? user.id : null,
        schoolId: request.schoolId,
        action,
        entityType: "id_card_request",
        entityId: request.id,
        newValues: {
          fromStatus: currentStatus,
          toStatus: targetStatus,
          studentName: request.studentName || "Student",
          admissionCode: request.admissionCode,
          comment,
          reason: comment,
        } as never,
      });
    }
  });

  // Send notifications
  if (targetStatus === "APPROVED" || targetStatus === "REJECTED") {
    const adminUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
    for (const a of adminUsers) {
      await notify(
        a.id,
        schoolId,
        action,
        `ID card ${targetStatus === "APPROVED" ? "approved" : "rejected"} by school: #${card?.cardNumber ?? request?.admissionCode}`,
        comment ?? `School marked ID card #${card?.cardNumber ?? request?.admissionCode} as ${targetStatus}`,
        "id_card",
        card?.id ?? request?.id,
      );
    }
  } else if (targetStatus === "RESUBMITTED") {
    const schoolUsers = await db.select({ id: users.id }).from(users).where(eq(users.schoolId, schoolId));
    for (const s of schoolUsers) {
      await notify(
        s.id,
        schoolId,
        action,
        `ID card resubmitted: #${card?.cardNumber ?? request?.admissionCode}`,
        `Admin resubmitted card for review`,
        "id_card",
        card?.id ?? request?.id,
      );
    }
  }

  res.json({ success: true, status: targetStatus });
}

// Approval endpoints (both /api/approvals and /api/id-cards)
// RBAC: review/approve/reject/request-changes require at least school manager role
router.post("/approvals/:id/review", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "UNDER_REVIEW", "START_REVIEW");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/request-changes", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "CHANGES_REQUIRED", "REQUEST_CHANGES", req.body.comment || req.body.note);
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/resubmit", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "RESUBMITTED", "RESUBMIT_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/approve", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "APPROVED", "APPROVE_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/reject", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards/:id/review", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "UNDER_REVIEW", "START_REVIEW");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/request-changes", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "CHANGES_REQUIRED", "REQUEST_CHANGES", req.body.comment || req.body.note);
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/resubmit", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "RESUBMITTED", "RESUBMIT_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/approve", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "APPROVED", "APPROVE_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/reject", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment);
  } catch (e) {
    fail(res, e);
  }
});

// Bulk Approve and Reject Endpoints (available to both Super Admin and School Managers for their schools)
async function handleBulkApprovalTransition(
  req: Request,
  res: Response,
  targetStatus: "APPROVED" | "REJECTED",
  action: string,
  comment?: string
) {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const cardIds: number[] = Array.isArray(req.body.cardIds) ? req.body.cardIds.map(Number) : [];
    if (cardIds.length === 0) return res.status(400).json({ error: "cardIds array is required" });

    const validCardIds = cardIds.filter((id) => id && !isNaN(id));
    if (validCardIds.length === 0) return res.status(400).json({ error: "No valid card IDs provided" });

    const isSuperAdmin = adminRoles.has(user.role);
    let successCount = 0;
    const errors: string[] = [];

    // Pre-fetch super admins once outside loop (eliminates N+1 query)
    const adminUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
    const notifyAdminIds = adminUsers.map((a) => a.id).filter((id) => id !== user.id);

    const isApprovalsRoute = req.baseUrl?.includes("approvals") || req.originalUrl?.includes("/api/approvals");

    let initialRequests: any[] = [];
    let initialCards: any[] = [];

    if (isApprovalsRoute) {
      initialRequests = await db.select().from(idCardRequests).where(inArray(idCardRequests.id, validCardIds));
      const foundReqIds = initialRequests.map((r) => r.id);
      const admissionCodes = initialRequests.map((r) => r.admissionCode).filter(Boolean);
      if (foundReqIds.length > 0) {
        initialCards = await db.select().from(idCards).where(
          and(
            isNull(idCards.removedAt),
            or(
              inArray(idCards.requestId, foundReqIds),
              admissionCodes.length > 0 ? inArray(idCards.cardNumber, admissionCodes) : sql`1=0`,
            ),
          ),
        );
      }
    } else {
      initialCards = await db.select().from(idCards).where(
        and(isNull(idCards.removedAt), inArray(idCards.id, validCardIds)),
      );
      const foundReqIds = initialCards.map((c) => c.requestId).filter(Boolean);
      if (foundReqIds.length > 0) {
        initialRequests = await db.select().from(idCardRequests).where(inArray(idCardRequests.id, foundReqIds));
      }
    }

    // For any IDs not found yet, check the alternative table
    const foundCardIds = new Set(initialCards.map((c) => c.id));
    const foundReqIds = new Set(initialRequests.map((r) => r.id));
    const missingIds = validCardIds.filter((id) => !foundCardIds.has(id) && !foundReqIds.has(id));

    if (missingIds.length > 0) {
      const extraRequests = await db.select().from(idCardRequests).where(inArray(idCardRequests.id, missingIds));
      const extraCards = await db.select().from(idCards).where(
        and(isNull(idCards.removedAt), inArray(idCards.id, missingIds)),
      );
      initialRequests.push(...extraRequests);
      initialCards.push(...extraCards);
    }

    const requestById = new Map<number, any>();
    for (const r of initialRequests) requestById.set(r.id, r);

    const cardById = new Map<number, any>();
    const cardByRequestId = new Map<number, any>();
    const cardBySchoolAndAdmission = new Map<string, any>();
    for (const c of initialCards) {
      cardById.set(c.id, c);
      if (c.requestId) cardByRequestId.set(c.requestId, c);
      if (c.schoolId && c.cardNumber) {
        cardBySchoolAndAdmission.set(c.schoolId + ':' + c.cardNumber, c);
      }
    }

    interface ValidBulkItem {
      cardId: number;
      card: any;
      request: any;
      schoolId: number;
      currentStatus: string;
    }

    const validToProcess: ValidBulkItem[] = [];

    for (const cardId of validCardIds) {
      let request = isApprovalsRoute ? requestById.get(cardId) : undefined;
      let card = !isApprovalsRoute ? cardById.get(cardId) : undefined;

      if (!card && request) {
        card = cardByRequestId.get(request.id) || cardBySchoolAndAdmission.get(request.schoolId + ':' + request.admissionCode);
      }
      if (!request && card && card.requestId) {
        request = requestById.get(card.requestId);
      }

      if (!request && !card) {
        request = requestById.get(cardId);
        card = cardById.get(cardId);
        if (!card && request) {
          card = cardByRequestId.get(request.id);
        } else if (card && !request && card.requestId) {
          request = requestById.get(card.requestId);
        }
      }

      const schoolId = card?.schoolId ?? request?.schoolId;
      if (!schoolId) {
        errors.push(`Card #${cardId} not found`);
        continue;
      }

      const isCardSchool = user.schoolId !== null && user.schoolId === schoolId;
      if (!isSuperAdmin && !isCardSchool) {
        errors.push(`Access denied for card #${cardId}`);
        continue;
      }

      const currentStatus = card?.status ?? request?.status ?? "DRAFT";
      if (
        currentStatus !== "UNDER_REVIEW" &&
        currentStatus !== "SUBMITTED" &&
        currentStatus !== "RESUBMITTED"
      ) {
        if (currentStatus === targetStatus) {
          successCount++;
          continue;
        }
        errors.push(`Card #${card?.cardNumber ?? cardId} cannot be ${targetStatus.toLowerCase()}d from ${currentStatus}`);
        continue;
      }

      validToProcess.push({
        cardId,
        card,
        request,
        schoolId,
        currentStatus,
      });
    }

    if (validToProcess.length > 0) {
      await db.transaction(async (tx) => {
        const reqIdsToUpdate = validToProcess.map((v) => v.request?.id).filter(Boolean) as number[];
        if (reqIdsToUpdate.length > 0) {
          await tx
            .update(idCardRequests)
            .set({
              status: targetStatus,
              reviewNote: comment ?? (targetStatus === "APPROVED" ? null : undefined),
              reviewedByUserId: user.id,
              reviewedAt: new Date(),
            })
            .where(inArray(idCardRequests.id, reqIdsToUpdate));
        }

        const cardsToUpdate = validToProcess.filter((v) => v.card);
        const cardIdsToUpdate = cardsToUpdate.map((v) => v.card.id);
        if (cardIdsToUpdate.length > 0) {
          await tx
            .update(idCards)
            .set({
              status: targetStatus,
              approvedByUserId: targetStatus === "APPROVED" ? user.id : undefined,
            })
            .where(inArray(idCards.id, cardIdsToUpdate));

          const historyEntries = cardsToUpdate.map((v) => ({
            idCardId: v.card.id,
            fromStatus: v.currentStatus as any,
            toStatus: targetStatus,
            action,
            comments: comment ?? (targetStatus === "APPROVED" ? "Bulk approved" : "Bulk rejected"),
            actedByUserId: user.id,
          }));
          await tx.insert(approvalHistory).values(historyEntries);

          const auditEntries = cardsToUpdate.map((v) => ({
            userId: user.id > 0 ? user.id : null,
            schoolId: v.card.schoolId,
            action,
            entityType: "id_card",
            entityId: v.card.id,
            newValues: {
              requestId: v.request?.id,
              cardNumber: v.card.cardNumber,
              studentName: v.request?.studentName || "Student",
              fromStatus: v.currentStatus,
              toStatus: targetStatus,
              comment,
              reason: comment,
              isBulk: true,
            } as never,
          }));
          await tx.insert(auditLogs).values(auditEntries);
        }
      });

      for (const v of validToProcess) {
        const ident = v.card?.cardNumber ?? v.request?.admissionCode;
        const targetEntityId = v.card?.id ?? v.request?.id;
        for (const adminId of notifyAdminIds) {
          void notify(
            adminId,
            v.schoolId,
            action,
            `ID card ${targetStatus === "APPROVED" ? "approved" : "rejected"}: #${ident}`,
            comment ?? `ID card #${ident} was ${targetStatus.toLowerCase()}d`,
            "id_card",
            targetEntityId,
          );
        }
      }

      successCount += validToProcess.length;
    }

    res.json({
      success: true,
      processed: successCount,
      totalRequested: cardIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    fail(res, e);
  }
}

router.post("/approvals/bulk-approve", requireRole(schoolManagerRoles), heavyOperationsLimiter, async (req, res) => {
  await handleBulkApprovalTransition(req, res, "APPROVED", "APPROVE_ID_CARD", req.body.comment);
});
router.post("/approvals/bulk-reject", requireRole(schoolManagerRoles), heavyOperationsLimiter, async (req, res) => {
  await handleBulkApprovalTransition(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment || "Rejected via bulk action");
});
router.post("/id-cards/bulk-approve", requireRole(schoolManagerRoles), heavyOperationsLimiter, async (req, res) => {
  await handleBulkApprovalTransition(req, res, "APPROVED", "APPROVE_ID_CARD", req.body.comment);
});
router.post("/id-cards/bulk-reject", requireRole(schoolManagerRoles), heavyOperationsLimiter, async (req, res) => {
  await handleBulkApprovalTransition(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment || "Rejected via bulk action");
});

router.post("/id-cards/bulk-remove-approved", requireRole(schoolManagerRoles), heavyOperationsLimiter, async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const rawIds = req.body?.cardIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: "cardIds must be a non-empty array of numbers" });
    }
    const cardIds = rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
    if (cardIds.length === 0) {
      return res.status(400).json({ error: "No valid card IDs provided" });
    }

    // Fetch candidate cards with template names and cardType
    const candidateCards = await db
      .select({
        id: idCards.id,
        schoolId: idCards.schoolId,
        cardNumber: idCards.cardNumber,
        status: idCards.status,
        templateId: idCards.templateId,
        templateName: idCardTemplates.name,
        cardType: idCardTemplates.cardType,
      })
      .from(idCards)
      .leftJoin(idCardTemplates, eq(idCards.templateId, idCardTemplates.id))
      .where(and(inArray(idCards.id, cardIds), isNull(idCards.removedAt)));

    // School admin can only remove cards for their own school. Cross-school yields 403 for the whole request.
    if (user.role === "SCHOOL_ADMIN") {
      for (const card of candidateCards) {
        if (card.schoolId !== user.schoolId) {
          return res.status(403).json({ error: "Cross-school card removal is forbidden" });
        }
      }
    }

    // Only cards with status APPROVED or PRINTED are removable
    const removableCards = candidateCards.filter((c) => c.status === "APPROVED" || c.status === "PRINTED");
    const removableIds = removableCards.map((c) => c.id);
    const skippedCount = cardIds.length - removableIds.length;

    if (removableCards.length === 0) {
      return res.json({
        success: true,
        removedCount: 0,
        skippedCount,
        removedIds: [],
        message: "No eligible approved or printed cards found to remove",
      });
    }

    // Fetch id_card_data for these cards to snapshot text fields (studentName, className, section)
    const cardDataRows = await db
      .select({
        idCardId: idCardData.idCardId,
        fieldKey: idCardData.fieldKey,
        fieldValue: idCardData.fieldValue,
      })
      .from(idCardData)
      .where(inArray(idCardData.idCardId, removableIds));

    const dataByCardId = new Map<number, Record<string, string>>();
    for (const row of cardDataRows) {
      const map = dataByCardId.get(row.idCardId) || {};
      map[row.fieldKey.toLowerCase()] = row.fieldValue || "";
      dataByCardId.set(row.idCardId, map);
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      // Soft-remove in id_cards
      await tx
        .update(idCards)
        .set({
          removedAt: now,
          removedByUserId: user.id,
        })
        .where(inArray(idCards.id, removableIds));

      // Insert snapshots into removed_cards_history
      for (const card of removableCards) {
        const cData = dataByCardId.get(card.id) || {};
        const isStaff = card.cardType === "staff" || Boolean(cData["employee_id"] || cData["employeeid"] || cData["staff_name"] || cData["staffname"]);
        const studentName = isStaff
          ? (cData["staff_name"] || cData["staffname"] || cData["name"] || cData["studentname"] || cData["student_name"] || "")
          : (cData["studentname"] || cData["student_name"] || cData["name"] || "");
        const className = isStaff
          ? (cData["designation"] || cData["department"] || cData["dept"] || cData["classname"] || cData["class_name"] || cData["class"] || "")
          : (cData["classname"] || cData["class_name"] || cData["class"] || "");
        const section = cData["section"] || "";

        await tx.insert(removedCardsHistory).values({
          idCardId: card.id,
          schoolId: card.schoolId,
          cardNumber: card.cardNumber,
          studentName,
          className,
          section,
          templateName: card.templateName || "Unknown Template",
          previousStatus: card.status,
          removedByUserId: user.id,
          removedByName: user.name,
          removedByRole: user.role,
          removedAt: now,
        });
      }
    });

    await audit(user, "REMOVE_APPROVED_CARDS", "id_card", null, user.schoolId || null, {
      count: removableIds.length,
      cardIds: removableIds,
      skippedCount,
    });

    res.json({
      success: true,
      removedCount: removableIds.length,
      skippedCount,
      removedIds: removableIds,
    });
  } catch (e) {
    fail(res, e);
  }
});

// ─── APPROVAL LIST ────────────────────────────────────────────────────────
listRouter.get("/approvals", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);

    const baseQuery = db
      .select({
        id: idCardRequests.id,
        studentName: idCardRequests.studentName,
        admissionCode: idCardRequests.admissionCode,
        schoolId: idCardRequests.schoolId,
        schoolName: schools.name,
        status: idCardRequests.status,
        reviewNote: idCardRequests.reviewNote,
        submittedAt: idCardRequests.submittedAt,
        reviewedAt: idCardRequests.reviewedAt,
        cardId: idCards.id,
        cardNumber: idCards.cardNumber,
      })
      .from(idCardRequests)
      .innerJoin(schools, eq(idCardRequests.schoolId, schools.id))
      .leftJoin(
        idCards,
        and(
          isNull(idCards.removedAt),
          or(
            eq(idCards.requestId, idCardRequests.id),
            and(
              eq(idCards.schoolId, idCardRequests.schoolId),
              eq(idCards.cardNumber, idCardRequests.admissionCode),
            ),
          ),
        ),
      );

    const statusParam = req.query.status ? String(req.query.status).trim() : undefined;
    const isFiltered = statusParam && statusParam !== "All";

    const whereConditions: any[] = [];
    if (adminRoles.has(user.role)) {
      if (req.query.schoolId) {
        whereConditions.push(eq(idCardRequests.schoolId, Number(req.query.schoolId)));
      }
    } else {
      if (!user.schoolId) return res.json([]);
      whereConditions.push(eq(idCardRequests.schoolId, user.schoolId));
    }

    if (isFiltered) {
      whereConditions.push(eq(idCardRequests.status, statusParam as any));
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = req.query.all === "true" || req.query.limit === "all"
      ? 1000
      : Math.min(100, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const whereClause = whereConditions.length > 1
      ? and(...whereConditions)
      : whereConditions[0];

    let query = baseQuery;
    if (whereClause) {
      query = query.where(whereClause) as any;
    }

    const rows = await query
      .orderBy(desc(idCardRequests.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(rows);
  } catch (e) {
    fail(res, e);
  }
});

export const approvalRoutes = router;
export const approvalListRoutes = listRouter;
