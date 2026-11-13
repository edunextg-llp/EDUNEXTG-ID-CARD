import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import {
  approvalHistory,
  auditLogs,
  idCardData,
  idCardFiles,
  idCardRequests,
  idCardTemplates,
  idCards,
  notifications,
  passwordResets,
  schoolTemplates,
  templateElements,
  schools,
  users,
  orders,
  removedCardsHistory,
  type User,
  type Order,
} from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import {
  checkAccountLockout,
  recordAccountLoginFailure,
  resetAccountLoginFailure,
  resolveClientIp,
  heavyOperationsLimiter,
  uploadLimiter,
  authenticatedApiLimiter,
} from "./_core/rateLimit";
import { authenticateApplicationRequest, clearApplicationSession, createPasswordReset, hashPassword, loginUser, resetPassword, setApplicationSession, signApplicationSession, verifyPassword } from "./appAuth";
import { generateSingleCardPdf, generateBulkCardPdf, type CardPdfData, type PrintPdfOptions } from "./pdf";
import { isValidIndianMobileNumber, INDIAN_MOBILE_ERROR_MESSAGE } from "../shared/phoneValidation";
import { generateExampleExcelBuffer, parseExcelBuffer } from "./excel";
import { getAvailableDynamicFields } from "../shared/templateDesigner";
import { DEFAULT_TEMPLATE_CARD_SIZE } from "../shared/printLayout";
import { HOOK_TYPES, CARD_MATERIALS, ORDER_TYPES, PRINT_SIDES, ORDER_STATUSES } from "../shared/orders";
import { processBulkPhotoUpload, compressPhotoBuffer, BulkPhotoError } from "./bulkPhotos";
import { detectImageMimeType } from "./imageValidation";
import { sanitizeForAudit } from "./auditSanitize";
import { authRoutes } from "./routes/authRoutes";
import { profileRoutes } from "./routes/profileRoutes";
import { schoolRoutes } from "./routes/schoolRoutes";
import { userRoutes } from "./routes/userRoutes";
import { templateRoutes, schoolTemplateRoutes } from "./routes/templateRoutes";
import { uploadRoutes } from "./routes/uploadRoutes";
import { notificationRoutes } from "./routes/notificationRoutes";
import { auditRoutes } from "./routes/auditRoutes";
import { reportRoutes } from "./routes/reportRoutes";
import { idCardRequestRoutes } from "./routes/idCardRequestRoutes";
import { orderRoutes } from "./routes/orderRoutes";
export { sanitizeForAudit };

const router = Router();
const adminRoles = new Set(["SUPER_ADMIN"]);
const schoolManagerRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
const schoolWriteRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "SCHOOL_OPERATOR"]);
const partnerRoles = new Set(["PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"]);
const schoolCreateRoles = new Set(["SUPER_ADMIN", "PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"]);
const orderRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"]);
const profileRoles = new Set(["SUPER_ADMIN", "PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"]);


function currentUser(res: Response) {
  return res.locals.user as User;
}
function safeUser(user: User) {
  const { passwordHash: _passwordHash, idPass: _idPass, ...publicUser } = user;
  return publicUser;
}

function parseJsonColumn(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeTemplateElement<T extends { config: unknown }>(element: T) {
  return { ...element, config: parseJsonColumn(element.config) };
}

function canManageSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || (schoolManagerRoles.has(user.role) && user.schoolId === schoolId);
}
function canWriteSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || (schoolWriteRoles.has(user.role) && user.schoolId === schoolId);
}

function canReadSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || partnerRoles.has(user.role) || (user.schoolId !== null && user.schoolId === schoolId);
}

function requestedSchoolId(user: User, value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return adminRoles.has(user.role) || partnerRoles.has(user.role) ? id : user.schoolId === id ? id : null;
}

async function audit(
  user: User,
  action: string,
  entityType: string,
  entityId: number | null,
  schoolId: number | null,
  newValues?: unknown,
  oldValues?: unknown,
) {
  const db = await getDb();
  if (!db) return;
  try {
    let validSchoolId = schoolId;
    if (validSchoolId) {
      const [exists] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, validSchoolId)).limit(1);
      if (!exists) validSchoolId = null;
    }
    await db.insert(auditLogs).values({
      userId: user.id > 0 ? user.id : null,
      schoolId: validSchoolId,
      action,
      actorRole: user.role,
      entityType,
      entityId,
      oldValues: oldValues !== undefined ? (sanitizeForAudit(oldValues) as never) : undefined,
      newValues: newValues !== undefined ? (sanitizeForAudit(newValues) as never) : undefined,
    });
  } catch (err) {
    console.warn("[Audit] Could not record audit log:", err);
  }
}

async function notify(userId: number, schoolId: number | null, type: string, title: string, message: string, entityType?: string, entityId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(notifications).values({ userId, schoolId, type, title, message, entityType, entityId });
  } catch (err) {
    console.warn("[Notification] Could not deliver notification:", err);
  }
}

async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateApplicationRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.locals.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Authentication required" });
  }
}

function requireRole(roles: Set<string>) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!roles.has(currentUser(res).role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

function fail(res: Response, error: unknown) {
  console.error("[API]", error);
  // In production, avoid leaking internal error details to the client
  const isProduction = process.env.NODE_ENV === "production";
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Database operation failed";
  const message = isProduction ? "An internal error occurred. Please try again or contact support." : rawMessage;
  return res.status(500).json({ error: message });
}

router.use(authRoutes);

router.use(auth);
router.use(authenticatedApiLimiter);

// Restrict Partner to auth, profile, notifications, orders, schools, and about
router.use((req, res, next) => {
  const user = currentUser(res);
  if (user && partnerRoles.has(user.role)) {
    const p = req.path;
    const isAllowed =
      p === "/profile" ||
      p.startsWith("/profile/") ||
      p === "/notifications" ||
      p.startsWith("/notifications/") ||
      p === "/orders" ||
      p.startsWith("/orders/") ||
      p === "/schools" ||
      p.startsWith("/schools/") ||
      p === "/about";

    if (!isAllowed) {
      return res.status(403).json({ error: "Insufficient permissions for partner" });
    }
  }
  next();
});

// --- About Us & Profile ----------------------------------------------------
router.use(profileRoutes);

router.use(schoolRoutes);

router.use(userRoutes);

router.use(templateRoutes);

router.use(uploadRoutes);

router.use(schoolTemplateRoutes);

// ─── ID CARD NUMBER GENERATOR ─────────────────────────────────────────────
async function generateCardNumber(schoolId: number): Promise<string> {
  const db = await getDb();
  const year = new Date().getFullYear();
  const prefix = `IDC-${year}-`;
  const existingCards = db
    ? await db.select({ cardNumber: idCards.cardNumber }).from(idCards).where(eq(idCards.schoolId, schoolId))
    : [];
  let seq = existingCards.length + 1;
  let candidate = `${prefix}${String(seq).padStart(6, "0")}`;
  const existingSet = new Set(existingCards.map((c) => c.cardNumber));
  while (existingSet.has(candidate)) {
    seq++;
    candidate = `${prefix}${String(seq).padStart(6, "0")}`;
  }
  return candidate;
}

// ─── ID CARDS CRUD ────────────────────────────────────────────────────────
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

// ─── PRINTING ─────────────────────────────────────────────────────────────
router.post("/id-cards/:id/print", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(and(eq(idCards.id, id), isNull(idCards.removedAt))))[0];
    if (!card || !canReadSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    // Strict rule: Only APPROVED cards may normally be printed
    if (card.status !== "APPROVED" && card.status !== "PRINTED") {
      return res.status(400).json({ error: `Only APPROVED cards may be printed. Current status: ${card.status}` });
    }

    if (card.status === "APPROVED") {
      await db.update(idCards).set({ status: "PRINTED", printedAt: new Date() }).where(eq(idCards.id, id));
      await db.insert(approvalHistory).values({
        idCardId: id,
        fromStatus: "APPROVED",
        toStatus: "PRINTED",
        action: "PRINT_ID_CARD",
        actedByUserId: user.id,
      });
    } else {
      await db.update(idCards).set({ printedAt: new Date() }).where(eq(idCards.id, id));
    }

    const mode = typeof req.body.mode === "string" ? req.body.mode : "DUPLEX";
    await audit(user, "PRINT_ID_CARD", "id_card", id, card.schoolId, { count: 1, mode });
    res.json({ success: true, status: "PRINTED", printedAt: new Date() });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards/:id/mark-printed", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(and(eq(idCards.id, id), isNull(idCards.removedAt))))[0];
    if (!card || !canReadSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    if (card.status !== "APPROVED" && card.status !== "PRINTED") {
      return res.status(400).json({ error: `Only APPROVED cards may be printed. Current status: ${card.status}` });
    }

    if (card.status === "APPROVED") {
      await db.update(idCards).set({ status: "PRINTED", printedAt: new Date() }).where(eq(idCards.id, id));
      await db.insert(approvalHistory).values({
        idCardId: id,
        fromStatus: "APPROVED",
        toStatus: "PRINTED",
        action: "PRINT_ID_CARD",
        actedByUserId: user.id,
      });
    } else {
      await db.update(idCards).set({ printedAt: new Date() }).where(eq(idCards.id, id));
    }

    await audit(user, "PRINT_ID_CARD", "id_card", id, card.schoolId);
    res.json({ success: true, status: "PRINTED", printedAt: new Date() });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards/bulk-print", requireRole(adminRoles), heavyOperationsLimiter, async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const cardIds: number[] = Array.isArray(req.body.cardIds) ? req.body.cardIds.map(Number) : [];
    if (cardIds.length === 0) return res.status(400).json({ error: "cardIds array is required" });
    const mode = typeof req.body.mode === "string" ? req.body.mode : "DUPLEX";

    const cards = await db.select().from(idCards).where(and(inArray(idCards.id, cardIds), isNull(idCards.removedAt)));
    for (const card of cards) {
      if (!canReadSchool(user, card.schoolId)) {
        return res.status(403).json({ error: `Access denied to card #${card.id}` });
      }
      if (card.status !== "APPROVED" && card.status !== "PRINTED") {
        return res.status(400).json({ error: `Card #${card.cardNumber} is not APPROVED (status: ${card.status})` });
      }
    }

    for (const card of cards) {
      if (card.status === "APPROVED") {
        await db.update(idCards).set({ status: "PRINTED", printedAt: new Date() }).where(eq(idCards.id, card.id));
        await db.insert(approvalHistory).values({
          idCardId: card.id,
          fromStatus: "APPROVED",
          toStatus: "PRINTED",
          action: "PRINT_ID_CARD",
          actedByUserId: user.id,
        });
      } else {
        await db.update(idCards).set({ printedAt: new Date() }).where(eq(idCards.id, card.id));
      }
      await audit(user, "PRINT_ID_CARD", "id_card", card.id, card.schoolId, { count: cards.length, mode });
    }

    res.json({ success: true, count: cards.length });
  } catch (e) {
    fail(res, e);
  }
});

// ─── PDF GENERATION ───────────────────────────────────────────────────────
async function fetchCardPdfData(db: any, cardId: number): Promise<CardPdfData | null> {
  const card = (await db.select().from(idCards).where(and(eq(idCards.id, cardId), isNull(idCards.removedAt))))[0];
  if (!card) return null;
  const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, card.templateId)))[0];
  if (!template) return null;
  const elements = (await db.select().from(templateElements).where(eq(templateElements.templateId, template.id))).map(normalizeTemplateElement);
  const dataRows = await db.select().from(idCardData).where(eq(idCardData.idCardId, card.id));
  const cardData: Record<string, string> = { cardNumber: card.cardNumber };
  for (const d of dataRows) cardData[d.fieldKey] = d.fieldValue || "";

  return {
    cardNumber: card.cardNumber,
    template: {
      cardWidth: template.cardWidth || DEFAULT_TEMPLATE_CARD_SIZE.width,
      cardHeight: template.cardHeight || DEFAULT_TEMPLATE_CARD_SIZE.height,
      orientation: template.orientation || "portrait",
      elements: elements.map((el: any) => ({
        elementKey: el.elementKey,
        elementType: el.elementType,
        label: el.label,
        config: el.config,
        sortOrder: el.sortOrder,
      })),
    },
    cardData,
  };
}

router.get("/id-cards/:id/pdf", requireRole(adminRoles), heavyOperationsLimiter, async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(and(eq(idCards.id, id), isNull(idCards.removedAt))))[0];
    if (!card || !canReadSchool(user, card.schoolId)) return res.status(404).json({ error: "ID card not found" });

    const pdfData = await fetchCardPdfData(db, id);
    if (!pdfData) return res.status(404).json({ error: "Template or card data missing for PDF" });

    const requestedMode = req.query.mode as PrintPdfOptions["mode"] | undefined;
    const defaultSide = requestedMode === "FRONT_ONLY" ? "FRONT" : requestedMode === "BACK_ONLY" ? "BACK" : "BOTH";
    const side = (req.query.side as "FRONT" | "BACK" | "BOTH") || defaultSide;
    const mode = requestedMode || (side === "BOTH" ? "DUPLEX" : side === "FRONT" ? "FRONT_ONLY" : "BACK_ONLY");
    const cropMarks = req.query.cropMarks !== "false";
    const pdfBuffer = await generateSingleCardPdf(pdfData, { side, mode, cropMarks });
    await audit(user, "DOWNLOAD_ID_CARD_PDF", "id_card", id, card.schoolId, { count: 1, mode, side });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="id_card_${card.cardNumber}_${side.toLowerCase()}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards/bulk-pdf", requireRole(adminRoles), heavyOperationsLimiter, async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const cardIds: number[] = Array.isArray(req.body.cardIds) ? req.body.cardIds.map(Number) : [];
    if (cardIds.length === 0) return res.status(400).json({ error: "cardIds array is required" });

    const pdfCards: CardPdfData[] = [];
    for (const cardId of cardIds) {
      const card = (await db.select().from(idCards).where(and(eq(idCards.id, cardId), isNull(idCards.removedAt))))[0];
      if (!card || !canReadSchool(user, card.schoolId)) {
        return res.status(403).json({ error: `Access denied to card #${cardId}` });
      }
      const item = await fetchCardPdfData(db, cardId);
      if (item) pdfCards.push(item);
    }

    if (pdfCards.length === 0) return res.status(404).json({ error: "No valid cards found for PDF" });

    const requestedMode = (req.body.mode as PrintPdfOptions["mode"] | undefined) || (req.query.mode as PrintPdfOptions["mode"] | undefined);
    const defaultSide = requestedMode === "FRONT_ONLY" ? "FRONT" : requestedMode === "BACK_ONLY" ? "BACK" : "BOTH";
    const side = (req.body.side as "FRONT" | "BACK" | "BOTH") || (req.query.side as "FRONT" | "BACK" | "BOTH") || defaultSide;
    const mode = requestedMode || (side === "BOTH" ? "DUPLEX" : side === "FRONT" ? "FRONT_ONLY" : "BACK_ONLY");
    const cropMarks = req.body.cropMarks !== false && req.query.cropMarks !== "false";
    const pdfBuffer = await generateBulkCardPdf(pdfCards, { side, mode, cropMarks });
    await audit(user, "DOWNLOAD_ID_CARD_PDF", "id_card", null, null, { count: pdfCards.length, mode, side });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="bulk_id_cards_${side.toLowerCase()}_${Date.now()}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (e) {
    fail(res, e);
  }
});

// ─── FILE METADATA ────────────────────────────────────────────────────────
router.post("/id-cards/:id/files", requireRole(adminRoles), uploadLimiter, async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card || !canWriteSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    const { fileType, fileName, fileUrl, mimeType, fileSize } = req.body;
    if (!fileType || !fileName || !fileUrl) {
      return res.status(400).json({ error: "fileType, fileName, and fileUrl are required" });
    }

    if (String(fileType) === "PHOTO") {
      if (fileSize && Number(fileSize) > 300 * 1024) {
        return res.status(400).json({ error: "Card photo exceeds 300KB size limit" });
      }
      if (typeof fileUrl === "string" && fileUrl.startsWith("data:")) {
        const b64 = fileUrl.includes(",") ? fileUrl.split(",")[1] : fileUrl;
        const approxBytes = Math.floor((b64.length * 3) / 4);
        if (approxBytes > 300 * 1024) {
          return res.status(400).json({ error: "Card photo exceeds 300KB size limit" });
        }
      }
    }

    const r = await db.insert(idCardFiles).values({
      idCardId: id,
      fileType: String(fileType),
      fileName: String(fileName),
      fileUrl: String(fileUrl),
      mimeType: mimeType ? String(mimeType) : null,
      fileSize: fileSize ? Number(fileSize) : null,
      uploadedByUserId: user.id,
    });
    const fileId = Number(r[0].insertId);
    res.status(201).json((await db.select().from(idCardFiles).where(eq(idCardFiles.id, fileId)))[0]);
  } catch (e) {
    fail(res, e);
  }
});

// ─── NOTIFICATIONS, AUDIT LOGS & APPROVALS ─────────────────────────────────
router.use(notificationRoutes);
router.use(auditRoutes);
router.use(reportRoutes);

router.get("/approvals", async (req, res) => {
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

router.use(idCardRequestRoutes);

router.use(orderRoutes);

export const apiRouter = router;
