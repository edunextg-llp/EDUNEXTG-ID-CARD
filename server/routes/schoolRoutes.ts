import { Router, type Request, type Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  approvalHistory,
  auditLogs,
  idCardData,
  idCardFiles,
  idCardRequests,
  idCards,
  idCardTemplates,
  notifications,
  orders,
  removedCardsHistory,
  schools,
  schoolTemplates,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { isValidIndianMobileNumber, INDIAN_MOBILE_ERROR_MESSAGE } from "../../shared/phoneValidation";
import { hashPassword } from "../appAuth";
import {
  adminRoles,
  audit,
  currentUser,
  fail,
  partnerRoles,
  requestedSchoolId,
  requireRole,
  sanitizeForAudit,
  schoolCreateRoles,
} from "./shared";

const router = Router();

async function attachSchoolTemplateMeta(db: any, schoolList: any[]) {
  if (!schoolList.length) return [];
  const defaultTemplates = await db
    .select({
      schoolId: schoolTemplates.schoolId,
      templateId: schoolTemplates.templateId,
      isDefault: schoolTemplates.isDefault,
      templateName: idCardTemplates.name,
      accent: idCardTemplates.accent,
      orientation: idCardTemplates.orientation,
      status: idCardTemplates.status,
    })
    .from(schoolTemplates)
    .innerJoin(idCardTemplates, eq(schoolTemplates.templateId, idCardTemplates.id))
    .where(eq(schoolTemplates.isDefault, true));

  const templateMap = new Map<number, (typeof defaultTemplates)[0]>();
  for (const dt of defaultTemplates) {
    templateMap.set(dt.schoolId, dt);
  }

  return schoolList.map((s) => {
    const tmpl = templateMap.get(s.id);
    return {
      ...s,
      selectedTemplateId: tmpl?.templateId ?? null,
      selectedTemplateName: tmpl?.templateName ?? null,
      templateSelectionStatus: tmpl ? ("Selected" as const) : ("Not Selected" as const),
      selectedTemplate: tmpl
        ? {
            id: tmpl.templateId,
            name: tmpl.templateName,
            accent: tmpl.accent,
            orientation: tmpl.orientation,
            status: tmpl.status,
          }
        : null,
    };
  });
}

router.get("/schools", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);
    const rows = adminRoles.has(user.role) || partnerRoles.has(user.role)
      ? await db.select().from(schools).orderBy(desc(schools.createdAt))
      : user.schoolId
      ? await db.select().from(schools).where(eq(schools.id, user.schoolId))
      : [];
    const enriched = await attachSchoolTemplateMeta(db, rows);

    if (adminRoles.has(user.role) && rows.length > 0) {
      const schoolIds = rows.map((r) => r.id);
      const schoolAdmins = await db
        .select({
          schoolId: users.schoolId,
          openId: users.openId,
          email: users.email,
          idPass: users.idPass,
        })
        .from(users)
        .where(and(eq(users.role, "SCHOOL_ADMIN"), inArray(users.schoolId, schoolIds)));

      const credMap = new Map<number, { loginId: string; email: string; password?: string }>();
      for (const sa of schoolAdmins) {
        if (sa.schoolId && sa.idPass) {
          credMap.set(sa.schoolId, {
            loginId: sa.openId,
            email: sa.email ?? "",
            password: sa.idPass,
          });
        }
      }

      for (const s of enriched) {
        const cred = credMap.get((s as any).id);
        if (cred) {
          (s as any).credentials = cred;
        }
      }
    }

    res.json(enriched);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/schools", requireRole(schoolCreateRoles), async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const shortCode = String(req.body.shortCode).trim();
    if (!shortCode) return res.status(400).json({ error: "shortCode is required" });

    const rawPhone = req.body.phone !== undefined && req.body.phone !== null ? String(req.body.phone).trim() : null;
    if (rawPhone && !isValidIndianMobileNumber(rawPhone, false)) {
      return res.status(400).json({ error: INDIAN_MOBILE_ERROR_MESSAGE });
    }

    let createdSchool: any;
    let credentials: any;

    await db.transaction(async (tx) => {
      const parsedTotalStrength = req.body.totalStrength !== undefined && req.body.totalStrength !== null && req.body.totalStrength !== ""
        ? Math.max(0, parseInt(String(req.body.totalStrength), 10) || 0)
        : null;

      const actor = currentUser(res);
      const result = await tx.insert(schools).values({
        name: String(req.body.name).trim(),
        shortCode,
        email: req.body.email ?? null,
        phone: rawPhone || null,
        address: req.body.address ?? null,
        board: req.body.board ? String(req.body.board).trim() : null,
        state: req.body.state ? String(req.body.state).trim() : null,
        district: req.body.district ? String(req.body.district).trim() : null,
        totalStrength: parsedTotalStrength,
        createdByUserId: actor.id > 0 ? actor.id : null,
      });
      const id = Number(result[0].insertId);

      // Auto-generate Login ID and ID Pass / Password for newly created school
      const cleanCode = shortCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || `SCH${id}`;
      let loginId = req.body.loginId && String(req.body.loginId).trim()
        ? String(req.body.loginId).trim()
        : `SCH_${cleanCode}`;

      // Ensure loginId uniqueness in users.openId
      const existingOpenId = (await tx.select({ id: users.id }).from(users).where(eq(users.openId, loginId)))[0];
      if (existingOpenId) {
        loginId = `SCH_${cleanCode}_${id}`;
      }

      const rawPassword = req.body.password && String(req.body.password).length >= 8
        ? String(req.body.password)
        : `Pass@${cleanCode}${Math.floor(1000 + Math.random() * 9000)}`;

      const userEmail = req.body.email && String(req.body.email).trim()
        ? String(req.body.email).trim()
        : null;

      const passwordHash = await hashPassword(rawPassword);

      await tx.insert(users).values({
        openId: loginId,
        name: `${String(req.body.name).trim()} Administrator`,
        email: userEmail,
        passwordHash,
        idPass: rawPassword,
        loginMethod: "local",
        role: "SCHOOL_ADMIN",
        schoolId: id,
        isActive: true,
      });

      await tx.insert(auditLogs).values({
        userId: currentUser(res).id > 0 ? currentUser(res).id : null,
        schoolId: id,
        action: "CREATE_SCHOOL",
        entityType: "school",
        entityId: id,
        newValues: sanitizeForAudit(req.body) as never,
      });

      createdSchool = (await tx.select().from(schools).where(eq(schools.id, id)))[0];
      credentials = {
        loginId,
        email: userEmail ?? "",
        password: rawPassword,
      };
    });

    const withTemplate = (await attachSchoolTemplateMeta(db, [createdSchool]))[0];
    res.status(201).json({
      ...withTemplate,
      credentials,
    });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/schools/:id/credentials", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const school = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    if (!school) return res.status(404).json({ error: "School not found" });

    const cleanCode = school.shortCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || `SCH${id}`;
    let loginId = `SCH_${cleanCode}`;

    // Find existing SCHOOL_ADMIN user for this school, or create one
    const existingUser = (
      await db
        .select()
        .from(users)
        .where(and(eq(users.schoolId, id), eq(users.role, "SCHOOL_ADMIN")))
    )[0];

    let userEmail = school.email && String(school.email).trim() ? String(school.email).trim() : null;
    if (existingUser) {
      loginId = existingUser.openId;
      userEmail = existingUser.email ?? userEmail;
    }

    const isExplicitChange = Boolean(req.body.password && String(req.body.password).length >= 8);
    const isExplicitRegenerate = Boolean(req.body.regenerate);

    let rawPassword: string;
    let shouldUpdatePassword = false;

    if (existingUser?.idPass && !isExplicitChange && !isExplicitRegenerate) {
      rawPassword = existingUser.idPass;
    } else {
      rawPassword = isExplicitChange
        ? String(req.body.password)
        : `Pass@${cleanCode}${Math.floor(1000 + Math.random() * 9000)}`;
      shouldUpdatePassword = true;
    }

    if (existingUser) {
      if (shouldUpdatePassword) {
        const passwordHash = await hashPassword(rawPassword);
        await db.update(users).set({ passwordHash, idPass: rawPassword, updatedAt: new Date() }).where(eq(users.id, existingUser.id));
      }
    } else {
      const existingWithOpenId = (await db.select({ id: users.id }).from(users).where(eq(users.openId, loginId)))[0];
      if (existingWithOpenId) loginId = `SCH_${cleanCode}_${id}`;
      const passwordHash = await hashPassword(rawPassword);
      await db.insert(users).values({
        openId: loginId,
        name: `${school.name} Administrator`,
        email: userEmail,
        passwordHash,
        idPass: rawPassword,
        loginMethod: "local",
        role: "SCHOOL_ADMIN",
        schoolId: id,
        isActive: true,
      });
    }

    await audit(currentUser(res), "GENERATE_SCHOOL_CREDENTIALS", "school", id, id, { loginId });
    res.json({
      success: true,
      credentials: {
        loginId,
        email: userEmail ?? "",
        password: rawPassword,
      },
    });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/schools/:id", async (req, res) => {
  try {
    const id = requestedSchoolId(currentUser(res), req.params.id);
    if (!id) return res.status(403).json({ error: "School access denied" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const row = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    if (!row) return res.status(404).json({ error: "School not found" });
    const enriched = (await attachSchoolTemplateMeta(db, [row]))[0];
    return res.json(enriched);
  } catch (e) {
    fail(res, e);
  }
});

const handleUpdateSchool = async (req: Request, res: Response) => {
  try {
    const user = currentUser(res);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid school id" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const existing = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    if (!existing) {
      return res.status(404).json({ error: "School not found. It may have been removed or deleted." });
    }

    // Role-based authorization:
    // SUPER_ADMIN can edit any school; partners can edit only schools they created.
    if (user.role !== "SUPER_ADMIN") {
      if (!existing.createdByUserId || existing.createdByUserId !== user.id) {
        return res.status(403).json({ error: "Forbidden: You can only edit schools created by your account" });
      }

      // Only SUPER_ADMIN may change a school's email and trigger SCHOOL_ADMIN email sync.
      // If a partner attempts to send/change email, return 403 Forbidden.
      if (req.body.email !== undefined) {
        return res.status(403).json({ error: "Forbidden: Only Super Admin can change school email" });
      }
    }

    const nextName = req.body.name && String(req.body.name).trim() ? String(req.body.name).trim() : existing.name;
    const nextCode = req.body.shortCode && String(req.body.shortCode).trim() ? String(req.body.shortCode).trim().toUpperCase() : existing.shortCode;
    const nextEmail = user.role === "SUPER_ADMIN"
      ? (req.body.email !== undefined ? (req.body.email && String(req.body.email).trim() ? String(req.body.email).trim() : null) : existing.email)
      : existing.email;
    const rawPhone = req.body.phone !== undefined ? (req.body.phone !== null ? String(req.body.phone).trim() : null) : undefined;
    if (rawPhone !== undefined && rawPhone !== null && rawPhone !== "" && !isValidIndianMobileNumber(rawPhone, false)) {
      return res.status(400).json({ error: INDIAN_MOBILE_ERROR_MESSAGE });
    }
    const nextPhone = rawPhone ? rawPhone.replace(/\D/g, "").slice(-10) : (rawPhone === "" ? null : (rawPhone ?? existing.phone));
    const nextAddress = req.body.address && String(req.body.address).trim() ? String(req.body.address).trim() : null;
    const nextBoard = req.body.board !== undefined ? (req.body.board && String(req.body.board).trim() ? String(req.body.board).trim() : null) : (existing.board ?? null);
    const nextState = req.body.state !== undefined ? (req.body.state && String(req.body.state).trim() ? String(req.body.state).trim() : null) : (existing.state ?? null);
    const nextDistrict = req.body.district !== undefined ? (req.body.district && String(req.body.district).trim() ? String(req.body.district).trim() : null) : (existing.district ?? null);
    const nextTotalStrength = req.body.totalStrength !== undefined
      ? (req.body.totalStrength !== null && req.body.totalStrength !== "" ? Math.max(0, parseInt(String(req.body.totalStrength), 10) || 0) : null)
      : (existing.totalStrength ?? null);

    if (nextCode !== existing.shortCode) {
      const [conflict] = await db.select().from(schools).where(eq(schools.shortCode, nextCode)).limit(1);
      if (conflict && conflict.id !== id) {
        return res.status(409).json({ error: `School code "${nextCode}" is already in use by another school.` });
      }
    }

    await db.update(schools).set({
      name: nextName,
      shortCode: nextCode,
      email: nextEmail,
      phone: nextPhone,
      address: nextAddress,
      board: nextBoard,
      state: nextState,
      district: nextDistrict,
      totalStrength: nextTotalStrength,
      updatedAt: new Date(),
    }).where(eq(schools.id, id));

    // Keep school admin user email in sync only if SUPER_ADMIN provided email
    if (user.role === "SUPER_ADMIN" && req.body.email !== undefined) {
      await db.update(users).set({ email: nextEmail }).where(and(eq(users.schoolId, id), eq(users.role, "SCHOOL_ADMIN")));
    }

    await audit(user, "UPDATE_SCHOOL", "school", id, id, req.body);
    const updated = (await attachSchoolTemplateMeta(db, [
      (await db.select().from(schools).where(eq(schools.id, id)))[0]
    ]))[0];
    res.json(updated);
  } catch (e) { fail(res, e); }
};

router.put("/schools/:id", requireRole(schoolCreateRoles), handleUpdateSchool);
router.patch("/schools/:id", requireRole(schoolCreateRoles), handleUpdateSchool);

const handleSchoolStatusUpdate = async (req: any, res: any) => {
  try {
    const user = currentUser(res);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid school id" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const existing = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    if (!existing) return res.status(404).json({ error: "School not found" });

    const nextIsActive = Boolean(req.body.isActive);
    await db.update(schools).set({ isActive: nextIsActive, updatedAt: new Date() }).where(eq(schools.id, id));
    await audit(user, "UPDATE_SCHOOL_STATUS", "school", id, id, { isActive: nextIsActive });
    const updated = (await attachSchoolTemplateMeta(db, [
      (await db.select().from(schools).where(eq(schools.id, id)))[0]
    ]))[0];
    res.json({ success: true, school: updated });
  } catch (e) { fail(res, e); }
};

router.patch("/schools/:id/status", requireRole(adminRoles), handleSchoolStatusUpdate);
router.post("/schools/:id/status", requireRole(adminRoles), handleSchoolStatusUpdate);

async function getSchoolDeletionSummary(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, schoolId: number) {
  const [school] = await db
    .select({ id: schools.id, name: schools.name, shortCode: schools.shortCode })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!school) return null;

  const [cardCount] = await db.select({ total: sql<number>`count(*)` }).from(idCards).where(eq(idCards.schoolId, schoolId));
  const [userCount] = await db.select({ total: sql<number>`count(*)` }).from(users).where(eq(users.schoolId, schoolId));
  const [requestCount] = await db.select({ total: sql<number>`count(*)` }).from(idCardRequests).where(eq(idCardRequests.schoolId, schoolId));
  const [orderCount] = await db.select({ total: sql<number>`count(*)` }).from(orders).where(eq(orders.schoolId, schoolId));
  const [removedCount] = await db.select({ total: sql<number>`count(*)` }).from(removedCardsHistory).where(eq(removedCardsHistory.schoolId, schoolId));

  return {
    schoolName: school.name,
    shortCode: school.shortCode,
    cards: Number(cardCount?.total ?? 0),
    users: Number(userCount?.total ?? 0),
    requests: Number(requestCount?.total ?? 0),
    orders: Number(orderCount?.total ?? 0),
    removedCards: Number(removedCount?.total ?? 0),
  };
}

// SUPER_ADMIN only (adminRoles). Used by the delete confirmation dialog to show what will be removed.
router.get("/schools/:id/deletion-summary", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid school id" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const summary = await getSchoolDeletionSummary(db, id);
    if (!summary) return res.status(404).json({ error: "School not found" });
    res.json(summary);
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/schools/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid school id" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const actor = currentUser(res);

    // Capture what is about to be removed BEFORE deleting, for the response and the audit trail.
    const summary = await getSchoolDeletionSummary(db, id);
    if (!summary) return res.status(404).json({ error: "School not found" });

    // Wrap entire cascade in a transaction to prevent partial deletes
    await db.transaction(async (tx) => {
      // Cleanly delete all dependent records and associated users so no orphaned users remain
      const schoolCards = await tx.select({ id: idCards.id }).from(idCards).where(eq(idCards.schoolId, id));
      const cardIdList = schoolCards.map((c) => c.id);
      if (cardIdList.length > 0) {
        await tx.delete(approvalHistory).where(inArray(approvalHistory.idCardId, cardIdList));
        await tx.delete(idCardFiles).where(inArray(idCardFiles.idCardId, cardIdList));
        await tx.delete(idCardData).where(inArray(idCardData.idCardId, cardIdList));
        await tx.delete(idCards).where(eq(idCards.schoolId, id));
      }
      await tx.delete(idCardRequests).where(eq(idCardRequests.schoolId, id));
      await tx.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, id));
      await tx.delete(notifications).where(eq(notifications.schoolId, id));
      await tx.delete(auditLogs).where(eq(auditLogs.schoolId, id));
      await tx.delete(removedCardsHistory).where(eq(removedCardsHistory.schoolId, id));
      await tx.delete(orders).where(eq(orders.schoolId, id));

      // Delete all associated users for this school
      const schoolUsers = await tx.select({ id: users.id }).from(users).where(eq(users.schoolId, id));
      const schoolUserIds = schoolUsers.map((u) => u.id);
      if (schoolUserIds.length > 0) {
        await tx.delete(approvalHistory).where(inArray(approvalHistory.actedByUserId, schoolUserIds));
        await tx.delete(notifications).where(inArray(notifications.userId, schoolUserIds));
        await tx.delete(auditLogs).where(inArray(auditLogs.userId, schoolUserIds));
        await tx.delete(users).where(eq(users.schoolId, id));
      }

      // Finally delete the school
      await tx.delete(schools).where(eq(schools.id, id));
    });

    await audit(actor, "DELETE_SCHOOL", "school", id, null, {
      schoolName: summary.schoolName,
      shortCode: summary.shortCode,
      cards: summary.cards,
      users: summary.users,
      requests: summary.requests,
      orders: summary.orders,
      removedCards: summary.removedCards,
    });
    res.status(200).json({ success: true, deleted: summary });
  } catch (e) {
    fail(res, e);
  }
});

export const schoolRoutes = router;
