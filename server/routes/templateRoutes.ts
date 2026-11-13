import { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  auditLogs,
  idCardRequests,
  idCardTemplates,
  idCards,
  schools,
  schoolTemplates,
  templateElements,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { DEFAULT_TEMPLATE_CARD_SIZE } from "../../shared/printLayout";
import {
  adminRoles,
  audit,
  canManageSchool,
  canReadSchool,
  currentUser,
  fail,
  normalizeTemplateElement,
  parseJsonColumn,
  requireRole,
  requestedSchoolId,
  schoolManagerRoles,
} from "./shared";

const router = Router();
const schoolRouter = Router();

router.get("/templates", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);
    const tmplList = adminRoles.has(user.role)
      ? await db.select().from(idCardTemplates).orderBy(desc(idCardTemplates.createdAt))
      : await db.select().from(idCardTemplates).where(eq(idCardTemplates.status, "ACTIVE")).orderBy(desc(idCardTemplates.createdAt));

    const allElements = (await db.select().from(templateElements)).map(normalizeTemplateElement);
    const elementsByTemplate = new Map<number, typeof allElements>();
    for (const el of allElements) {
      const list = elementsByTemplate.get(el.templateId) ?? [];
      list.push(el);
      elementsByTemplate.set(el.templateId, list);
    }

    const result = tmplList.map((tmpl) => ({
      ...tmpl,
      elements: elementsByTemplate.get(tmpl.id) ?? [],
    }));
    res.json(result);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/templates", requireRole(adminRoles), async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const r = await db.insert(idCardTemplates).values({
      name: String(req.body.name),
      meta: req.body.meta ?? null,
      description: req.body.description ?? null,
      status: req.body.status ?? "DRAFT",
      accent: req.body.accent ?? "teal",
      orientation: req.body.orientation ?? "portrait",
      cardType: req.body.cardType ?? "student",
      cardWidth: req.body.cardWidth ? Number(req.body.cardWidth) : DEFAULT_TEMPLATE_CARD_SIZE.width,
      cardHeight: req.body.cardHeight ? Number(req.body.cardHeight) : DEFAULT_TEMPLATE_CARD_SIZE.height,
      createdByUserId: currentUser(res).id,
    });
    const id = Number(r[0].insertId);
    await audit(currentUser(res), "CREATE_TEMPLATE", "template", id, null, req.body);
    res.status(201).json((await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0]);
  } catch (e) {
    fail(res, e);
  }
});

router.get("/templates/:id", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0];
    if (!template) return res.status(404).json({ error: "Template not found" });
    const user = currentUser(res);
    if (!adminRoles.has(user.role) && template.status !== "ACTIVE") {
      return res.status(404).json({ error: "Template not found" });
    }
    const elements = (await db.select().from(templateElements).where(eq(templateElements.templateId, id))).map(normalizeTemplateElement);
    res.json({ ...template, elements });
  } catch (e) {
    fail(res, e);
  }
});

const updateTemplateStatusHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Validate status is a valid enum value
    const validStatuses = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"];
    if (!req.body.status || !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0];
    if (!template) return res.status(404).json({ error: "Template not found" });

    await db.update(idCardTemplates).set({ status: req.body.status }).where(eq(idCardTemplates.id, id));
    await audit(currentUser(res), "UPDATE_TEMPLATE_STATUS", "template", id, null, req.body);
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
};
router.patch("/templates/:id/status", requireRole(adminRoles), updateTemplateStatusHandler);
router.post("/templates/:id/status", requireRole(adminRoles), updateTemplateStatusHandler);

router.put("/templates/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid template ID" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const existingTemplate = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0];
    if (!existingTemplate) return res.status(404).json({ error: "Template not found" });

    const updateSet: Record<string, unknown> = {};
    if (req.body.name !== undefined) updateSet.name = req.body.name;
    if (req.body.meta !== undefined) updateSet.meta = req.body.meta;
    if (req.body.description !== undefined) updateSet.description = req.body.description;
    if (req.body.accent !== undefined) updateSet.accent = req.body.accent;
    if (req.body.status !== undefined) updateSet.status = req.body.status;
    if (req.body.orientation !== undefined) updateSet.orientation = req.body.orientation;
    if (req.body.cardType !== undefined) updateSet.cardType = req.body.cardType;
    if (req.body.cardWidth !== undefined) updateSet.cardWidth = Number(req.body.cardWidth);
    if (req.body.cardHeight !== undefined) updateSet.cardHeight = Number(req.body.cardHeight);
    if (Object.keys(updateSet).length) await db.update(idCardTemplates).set(updateSet).where(eq(idCardTemplates.id, id));

    if (Array.isArray(req.body.elements)) {
      // Reconcile existing elements to preserve IDs
      const existingElements = await db.select().from(templateElements).where(eq(templateElements.templateId, id));
      const existingByKey = new Map(existingElements.map((el) => [el.elementKey, el]));
      const incomingKeys = new Set<string>();

      for (let i = 0; i < req.body.elements.length; i++) {
        const element = req.body.elements[i];
        incomingKeys.add(element.elementKey);
        const existing = existingByKey.get(element.elementKey);
        if (existing) {
          await db
            .update(templateElements)
            .set({
              elementType: element.elementType,
              label: element.label ?? null,
              config: parseJsonColumn(element.config) as never,
              sortOrder: element.sortOrder ?? i,
            })
            .where(eq(templateElements.id, existing.id));
        } else {
          await db.insert(templateElements).values({
            templateId: id,
            elementKey: element.elementKey,
            elementType: element.elementType,
            label: element.label ?? null,
            config: parseJsonColumn(element.config) as never,
            sortOrder: element.sortOrder ?? i,
          });
        }
      }

      // Delete removed elements
      for (const existing of existingElements) {
        if (!incomingKeys.has(existing.elementKey)) {
          await db.delete(templateElements).where(eq(templateElements.id, existing.id));
        }
      }
    }

    await audit(currentUser(res), "UPDATE_TEMPLATE", "template", id, null, req.body);
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/templates/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid template ID" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0];
    if (!template) return res.status(404).json({ error: "Template not found" });

    // Check if any ID cards are using this template
    const usedByCards = await db.select({ id: idCards.id }).from(idCards).where(eq(idCards.templateId, id)).limit(1);
    if (usedByCards.length > 0) {
      return res.status(400).json({
        error: "Cannot delete template: it is currently used by ID cards. Please set its status to INACTIVE or ARCHIVED instead.",
      });
    }

    // Check if any ID card requests reference this template
    const usedByRequests = await db.select({ id: idCardRequests.id }).from(idCardRequests).where(eq(idCardRequests.templateId, id)).limit(1);
    if (usedByRequests.length > 0) {
      return res.status(400).json({
        error: "Cannot delete template: it is currently referenced by approval requests. Please set its status to INACTIVE or ARCHIVED instead.",
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(templateElements).where(eq(templateElements.templateId, id));
      await tx.delete(schoolTemplates).where(eq(schoolTemplates.templateId, id));
      await tx.delete(idCardTemplates).where(eq(idCardTemplates.id, id));
      await tx.insert(auditLogs).values({
        userId: currentUser(res).id > 0 ? currentUser(res).id : null,
        schoolId: null,
        action: "DELETE_TEMPLATE",
        entityType: "template",
        entityId: id,
      });
    });

    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

// ─── SCHOOL TEMPLATES ─────────────────────────────────────────────────────
schoolRouter.get("/schools/:schoolId/templates", async (req, res) => {
  try {
    const user = currentUser(res);
    const schoolId = requestedSchoolId(user, req.params.schoolId);
    if (!schoolId || !canReadSchool(user, schoolId)) return res.status(403).json({ error: "School access denied" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    res.json(await db.select().from(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolId)));
  } catch (e) {
    fail(res, e);
  }
});

schoolRouter.post("/schools/:schoolId/templates/select", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const schoolId = requestedSchoolId(user, req.params.schoolId);
    if (!schoolId || !canManageSchool(user, schoolId)) return res.status(403).json({ error: "School access denied" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const templateId = Number(req.body.templateId);
    const targetTemplate = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, templateId)))[0];
    if (!targetTemplate) return res.status(404).json({ error: "Template not found" });
    if (targetTemplate.status !== "ACTIVE" && !adminRoles.has(user.role)) {
      return res.status(400).json({ error: "Only ACTIVE templates can be selected" });
    }
    const existing = (
      await db
        .select()
        .from(schoolTemplates)
        .where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.templateId, templateId)))
    )[0];
    if (existing?.isLocked) return res.status(409).json({ error: "Template selection is locked" });

    // Atomically reset previous default templates for this school
    await db.update(schoolTemplates).set({ isDefault: false }).where(eq(schoolTemplates.schoolId, schoolId));

    const [targetSchool] = await db.select({ name: schools.name, code: schools.shortCode }).from(schools).where(eq(schools.id, schoolId));

    if (existing) await db.update(schoolTemplates).set({ isDefault: true, assignedByUserId: user.id }).where(eq(schoolTemplates.id, existing.id));
    else await db.insert(schoolTemplates).values({ schoolId, templateId, isDefault: true, assignedByUserId: user.id });
    await audit(user, "SELECT_TEMPLATE", "school_template", existing?.id ?? null, schoolId, {
      templateId,
      templateName: targetTemplate.name,
      schoolName: targetSchool?.name,
      schoolCode: targetSchool?.code,
    });
    res.json({ success: true, selectedTemplateId: templateId, selectedTemplateName: targetTemplate.name });
  } catch (e) {
    fail(res, e);
  }
});

schoolRouter.post("/schools/:schoolId/templates/unselect", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const schoolId = requestedSchoolId(user, req.params.schoolId);
    if (!schoolId || !canManageSchool(user, schoolId)) return res.status(403).json({ error: "School access denied" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Check if any template is locked – cannot unselect a locked template
    const locked = (
      await db
        .select()
        .from(schoolTemplates)
        .where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isLocked, true), eq(schoolTemplates.isDefault, true)))
    )[0];
    if (locked) return res.status(409).json({ error: "Cannot unselect a locked template. Unlock it first." });

    const [prevDefault] = await db
      .select({
        templateId: schoolTemplates.templateId,
        templateName: idCardTemplates.name,
      })
      .from(schoolTemplates)
      .leftJoin(idCardTemplates, eq(schoolTemplates.templateId, idCardTemplates.id))
      .where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isDefault, true)))
      .limit(1);

    const [targetSchool] = await db.select({ name: schools.name, code: schools.shortCode }).from(schools).where(eq(schools.id, schoolId));

    await db.update(schoolTemplates).set({ isDefault: false }).where(eq(schoolTemplates.schoolId, schoolId));
    await audit(user, "UNSELECT_TEMPLATE", "school_template", null, schoolId, {
      templateId: prevDefault?.templateId,
      templateName: prevDefault?.templateName,
      schoolName: targetSchool?.name,
      schoolCode: targetSchool?.code,
    });
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

for (const action of ["lock", "unlock"] as const)
  schoolRouter.post(`/schools/:schoolId/templates/${action}`, requireRole(schoolManagerRoles), async (req, res) => {
    try {
      const user = currentUser(res);
      const schoolId = requestedSchoolId(user, req.params.schoolId);
      if (!schoolId || !canManageSchool(user, schoolId)) return res.status(403).json({ error: "School access denied" });
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database not available" });
      const templateId = Number(req.body.templateId);
      await db
        .update(schoolTemplates)
        .set(
          action === "lock"
            ? { isLocked: true, lockedAt: new Date(), lockedByUserId: user.id }
            : { isLocked: false, lockedAt: null, lockedByUserId: null },
        )
        .where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.templateId, templateId)));
      await audit(user, action === "lock" ? "LOCK_TEMPLATE" : "UNLOCK_TEMPLATE", "school_template", null, schoolId, { templateId });
      res.json({ success: true });
    } catch (e) {
      fail(res, e);
    }
  });

export const templateRoutes = router;
export const schoolTemplateRoutes = schoolRouter;
