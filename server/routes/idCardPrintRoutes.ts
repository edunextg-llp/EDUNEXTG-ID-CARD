import { Router } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  approvalHistory,
  idCardData,
  idCardFiles,
  idCards,
  idCardTemplates,
  templateElements,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { heavyOperationsLimiter, uploadLimiter } from "../_core/rateLimit";
import { generateSingleCardPdf, generateBulkCardPdf, type CardPdfData, type PrintPdfOptions } from "../pdf";
import { DEFAULT_TEMPLATE_CARD_SIZE } from "../../shared/printLayout";
import {
  adminRoles,
  audit,
  canReadSchool,
  canWriteSchool,
  currentUser,
  fail,
  normalizeTemplateElement,
  requireRole,
} from "./shared";

const router = Router();

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

export const idCardPrintRoutes = router;
