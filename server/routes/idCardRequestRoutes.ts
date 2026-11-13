import path from "node:path";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  idCardData,
  idCardRequests,
  idCards,
  idCardTemplates,
  schools,
  schoolTemplates,
  templateElements,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { heavyOperationsLimiter } from "../_core/rateLimit";
import { getAvailableDynamicFields } from "../../shared/templateDesigner";
import { generateExampleExcelBuffer, parseExcelBuffer } from "../excel";
import { processBulkPhotoUpload, BulkPhotoError } from "../bulkPhotos";
import {
  adminRoles,
  audit,
  currentUser,
  fail,
  generateCardNumber,
  requireRole,
  schoolWriteRoles,
} from "./shared";

const router = Router();

// ─── ID CARD REQUESTS EXCEL IMPORT & EXAMPLE DOWNLOAD ─────────────────────
router.get("/id-card-requests/example-excel", async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Determine target school
    let schoolId: number | null = null;
    if (adminRoles.has(user.role)) {
      schoolId = req.query.schoolId ? Number(req.query.schoolId) : null;
    } else {
      schoolId = user.schoolId;
    }

    // Determine template: check query, school's locked/default, or active template
    let templateId: number | null = req.query.templateId ? Number(req.query.templateId) : null;
    if (!templateId && schoolId) {
      const schoolTmpl =
        (await db.select().from(schoolTemplates).where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isLocked, true))))[0] ||
        (await db.select().from(schoolTemplates).where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isDefault, true))))[0];
      templateId = schoolTmpl?.templateId ?? null;
    }
    if (!templateId) {
      const activeTmpl = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.status, "ACTIVE")).limit(1))[0];
      templateId = activeTmpl?.id ?? null;
    }

    let elements: any[] = [];
    if (templateId) {
      const tableElements = await db.select().from(templateElements).where(eq(templateElements.templateId, templateId));
      if (tableElements.length > 0) {
        elements = tableElements;
      } else {
        const tmpl = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, templateId)))[0] as any;
        if (tmpl?.canvasData && Array.isArray(tmpl.canvasData.elements)) {
          elements = tmpl.canvasData.elements;
        } else if (tmpl?.meta) {
          try {
            const parsed = JSON.parse(tmpl.meta);
            if (Array.isArray(parsed?.elements)) elements = parsed.elements;
          } catch {}
        }
      }
    }

    // Determine cardType: from query param, template, or default
    let cardType: "student" | "staff" = (req.query.cardType as string) === "staff" ? "staff" : "student";
    if (!req.query.cardType && templateId) {
      const tmplRow = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, templateId)))[0] as any;
      if (tmplRow?.cardType === "staff") cardType = "staff";
    }

    // Dynamic field list driven by designer/template configuration
    const availableFields = getAvailableDynamicFields(elements, cardType);
    const excelBuffer = await generateExampleExcelBuffer(availableFields);

    const fileLabel = cardType === "staff" ? "staff" : "student";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="id_card_requests_${fileLabel}_template.xlsx"`);
    res.setHeader("Content-Length", excelBuffer.length);
    res.end(excelBuffer);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-card-requests/upload-excel", requireRole(schoolWriteRoles), heavyOperationsLimiter, async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const { fileBase64, filename } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: "No Excel file provided" });
    }

    // Validate file extension
    const ext = path.extname(filename || "").toLowerCase();
    if (ext && ![".xlsx", ".xls", ".csv"].includes(ext)) {
      return res.status(400).json({ error: "Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file." });
    }

    // Determine target school strictly respecting RBAC and multi-tenant isolation
    let schoolId: number;
    if (adminRoles.has(user.role)) {
      schoolId = Number(req.body.schoolId);
      if (!schoolId) {
        return res.status(400).json({ error: "School ID is required for Excel import" });
      }
    } else {
      if (!user.schoolId) {
        return res.status(403).json({ error: "You are not assigned to a school" });
      }
      if (req.body.schoolId && Number(req.body.schoolId) !== user.schoolId) {
        return res.status(403).json({ error: "Forbidden: You cannot upload cards for another school" });
      }
      schoolId = user.schoolId;
    }

    const school = (await db.select().from(schools).where(eq(schools.id, schoolId)))[0];
    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }
    if (!school.isActive && !adminRoles.has(user.role)) {
      return res.status(403).json({ error: "School is currently inactive" });
    }

    // Determine template
    let templateId = Number(req.body.templateId);
    if (!templateId) {
      const schoolTmpl =
        (await db.select().from(schoolTemplates).where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isLocked, true))))[0] ||
        (await db.select().from(schoolTemplates).where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isDefault, true))))[0];
      templateId = schoolTmpl?.templateId ?? (await db.select().from(idCardTemplates).where(eq(idCardTemplates.status, "ACTIVE")).limit(1))[0]?.id;
    }

    if (!templateId) {
      return res.status(400).json({ error: "No active ID card template found for this school" });
    }

    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, templateId)))[0];
    if (!template) {
      return res.status(404).json({ error: "Selected template not found" });
    }

    const tmplElements = await db.select().from(templateElements).where(eq(templateElements.templateId, templateId));
    const availableFields = getAvailableDynamicFields(tmplElements, (template as any)?.cardType || "student");

    // Decode base64 buffer
    let fileBuffer: Buffer;
    try {
      const cleanBase64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
      fileBuffer = Buffer.from(cleanBase64, "base64");
    } catch {
      return res.status(400).json({ error: "Malformed file encoding" });
    }

    // Max 5MB limit
    if (fileBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "File exceeds 5MB limit" });
    }

    // Parse Excel safely
    let parseResult: Awaited<ReturnType<typeof parseExcelBuffer>>;
    try {
      parseResult = await parseExcelBuffer(fileBuffer, availableFields);
    } catch (parseErr: any) {
      return res.status(400).json({ error: parseErr.message || "Failed to read Excel spreadsheet" });
    }

    if (parseResult.rows.length === 0) {
      return res.status(400).json({
        error: "No valid data rows found in the uploaded file",
        details: parseResult.errors.map((e) => `Row ${e.rowNumber}: ${e.reason}`),
      });
    }

    let successCount = 0;
    const failedRows: Array<{ rowNumber: number; reason: string }> = [...parseResult.errors];
    const createdCardIds: number[] = [];

    // Query existing card numbers and request admission codes for this school to avoid duplicates
    const [existingCards, existingRequests] = await Promise.all([
      db.select({ cardNumber: idCards.cardNumber }).from(idCards).where(eq(idCards.schoolId, schoolId)),
      db.select({ admissionCode: idCardRequests.admissionCode }).from(idCardRequests).where(eq(idCardRequests.schoolId, schoolId)),
    ]);
    const existingCardSet = new Set<string>([
      ...existingCards.map((c) => c.cardNumber.toUpperCase()),
      ...existingRequests.map((r) => r.admissionCode.toUpperCase()),
    ]);

    for (const row of parseResult.rows) {
      const studentName = row.studentName || row.data["student_name"] || "Student";
      let admissionCode = row.admissionCode || row.data["admission_number"] || row.data["roll_number"];

      if (!admissionCode) {
        admissionCode = await generateCardNumber(schoolId);
      }

      if (existingCardSet.has(admissionCode.toUpperCase())) {
        failedRows.push({
          rowNumber: row.rowNumber,
          reason: `Student admission code / card number '${admissionCode}' already exists for this school.`,
        });
        continue;
      }

      try {
        await db.transaction(async (tx) => {
          // 1. Create idCardRequests entry
          const reqRes = await tx.insert(idCardRequests).values({
            studentName,
            admissionCode,
            schoolId,
            status: "DRAFT",
            templateId,
            requestedByUserId: user.id,
            submittedAt: null,
          });
          const reqId = Number(reqRes[0].insertId);

          // 2. Create idCards entry
          const cardRes = await tx.insert(idCards).values({
            schoolId,
            templateId,
            requestId: reqId,
            cardNumber: admissionCode,
            status: "DRAFT",
            submittedByUserId: user.id,
          });
          const cardId = Number(cardRes[0].insertId);
          createdCardIds.push(cardId);

          // 3. Save dynamic fields in id_card_data
          // CRITICAL: Only fields that have non-empty values are inserted!
          for (const [fieldKey, val] of Object.entries(row.data)) {
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              await tx.insert(idCardData).values({
                idCardId: cardId,
                fieldKey,
                fieldValue: String(val).trim(),
              });
            }
          }
        });

        existingCardSet.add(admissionCode.toUpperCase());
        successCount++;
      } catch (insertErr: any) {
        let msg = insertErr?.message || "Database insert error";
        if (insertErr?.code === "ER_DUP_ENTRY" || insertErr?.errno === 1062) {
          msg = `Student admission code / card number '${admissionCode}' already exists for this school.`;
        }
        failedRows.push({
          rowNumber: row.rowNumber,
          reason: msg,
        });
      }
    }

    // Audit log
    await audit(user, "UPLOAD_EXCEL_REQUESTS", "school", schoolId, schoolId, {
      filename: filename || "upload.xlsx",
      totalRows: parseResult.rows.length,
      successCount,
      failedCount: failedRows.length,
      templateId,
    });

    res.json({
      success: true,
      processed: successCount,
      failed: failedRows.length,
      total: parseResult.rows.length,
      errors: failedRows.length > 0 ? failedRows : undefined,
    });
  } catch (e) {
    fail(res, e);
  }
});

router.post(
  ["/id-card-requests/bulk-upload-photos", "/id-cards/bulk-upload-photos"],
  requireRole(schoolWriteRoles),
  heavyOperationsLimiter,
  async (req, res) => {
    try {
      const user = currentUser(res);
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database not available" });

      // RBAC and multi-tenant isolation
      let schoolId: number;
      if (adminRoles.has(user.role)) {
        schoolId = Number(req.body.schoolId);
        if (!schoolId) {
          return res.status(400).json({ error: "School ID is required for photo upload" });
        }
      } else {
        if (!user.schoolId) {
          return res.status(403).json({ error: "You are not assigned to a school" });
        }
        if (req.body.schoolId && Number(req.body.schoolId) !== user.schoolId) {
          return res.status(403).json({ error: "Forbidden: You cannot upload photos for another school" });
        }
        schoolId = user.schoolId;
      }

      const school = (await db.select().from(schools).where(eq(schools.id, schoolId)))[0];
      if (!school) {
        return res.status(404).json({ error: "School not found" });
      }
      if (!school.isActive && !adminRoles.has(user.role)) {
        return res.status(403).json({ error: "School is currently inactive" });
      }

      const result = await processBulkPhotoUpload(db, {
        schoolId,
        userId: user.id,
        zipBase64: req.body.zipBase64,
        images: req.body.images,
        dryRun: Boolean(req.body.dryRun),
      });

      if (!req.body.dryRun) {
        await audit(user, "BULK_UPLOAD_PHOTOS", "school", schoolId, schoolId, {
          total: result.total,
          matched: result.matched,
          unmatched: result.unmatched,
        });
      }

      res.json(result);
    } catch (e: any) {
      if (e instanceof BulkPhotoError || e?.statusCode === 400 || e?.isClientError) {
        return res.status(400).json({ error: e.message });
      }
      fail(res, e);
    }
  },
);

export const idCardRequestRoutes = router;
