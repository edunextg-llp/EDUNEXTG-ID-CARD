import { Router } from "express";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { auditLogs, notifications, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { hashPassword } from "../appAuth";
import { adminRoles, audit, currentUser, fail, requireRole, safeUser } from "./shared";

const router = Router();

router.get("/users", requireRole(adminRoles), async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const rows = await db
      .select()
      .from(users)
      .where(sql`${users.email} IS NULL OR (${users.email} NOT LIKE '%@test.local' AND ${users.email} NOT LIKE '%@example.test' AND ${users.openId} NOT LIKE 'seed_%')`)
      .orderBy(desc(users.createdAt));
    res.json(
      rows.map((u) => {
        const safe = safeUser(u);
        return {
          ...safe,
          credentials: u.idPass
            ? {
                loginId: u.openId,
                email: u.email ?? "",
                phone: u.phone ?? "",
                name: u.name ?? "",
                password: u.idPass,
              }
            : undefined,
        };
      })
    );
  } catch (e) { fail(res, e); }
});

router.post("/users", requireRole(adminRoles), async (req, res) => {
  try {
    const actor = currentUser(res);
    const role = req.body.role;
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        error: "Only Admin (SUPER_ADMIN), School Admin (SCHOOL_ADMIN), and Partner (PARTNER) can be created.",
      });
    }
    if (String(req.body.password ?? "").length < 8) {
      return res.status(400).json({ error: "A password of at least 8 characters is required" });
    }
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Generate or validate openId uniqueness
    const openId = String(req.body.openId ?? `local_${Date.now()}`);
    const existingOpenId = (await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)))[0];
    if (existingOpenId) {
      return res.status(409).json({ error: `Login ID "${openId}" is already in use. Please choose a different one.` });
    }

    let targetSchoolId: number | null = null;
    if (role === "SCHOOL_ADMIN" && req.body.schoolId) {
      targetSchoolId = Number(req.body.schoolId);
      if (!Number.isInteger(targetSchoolId) || targetSchoolId <= 0) {
        targetSchoolId = null;
      }
    }

    const cleanEmail = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
    if (cleanEmail) {
      const existingEmail = (await db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)))[0];
      if (existingEmail) {
        return res.status(409).json({ error: `Email "${cleanEmail}" is already in use.` });
      }
    }

    const rawPassword = req.body.password ? String(req.body.password) : null;
    const passwordHash = rawPassword ? await hashPassword(rawPassword) : null;

    const result = await db.insert(users).values({
      openId,
      name: req.body.name ?? null,
      email: cleanEmail,
      phone: req.body.phone ? String(req.body.phone).trim() : null,
      state: req.body.state ? String(req.body.state).trim() : null,
      district: req.body.district ? String(req.body.district).trim() : null,
      loginMethod: "local",
      passwordHash,
      idPass: rawPassword,
      role,
      schoolId: targetSchoolId,
    });
    const id = Number(result[0].insertId);
    await audit(actor, "CREATE_USER", "user", id, targetSchoolId, { ...req.body, role, schoolId: targetSchoolId });
    res.status(201).json(safeUser((await db.select().from(users).where(eq(users.id, id)))[0]));
  } catch (e) { fail(res, e); }
});

router.get("/users/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const target = (await db.select().from(users).where(eq(users.id, Number(req.params.id))))[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    res.json(safeUser(target));
  } catch (e) { fail(res, e); }
});

router.put("/users/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const actor = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const target = (await db.select().from(users).where(eq(users.id, id)))[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    const nextSchoolId = req.body.schoolId !== undefined ? (req.body.schoolId ? Number(req.body.schoolId) : null) : target.schoolId;
    let nextEmail = target.email;
    if (req.body.email !== undefined) {
      const cleanEmail = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
      if (cleanEmail) {
        const existingEmail = (await db.select({ id: users.id }).from(users).where(and(eq(users.email, cleanEmail), ne(users.id, id))))[0];
        if (existingEmail) {
          return res.status(409).json({ error: `Email "${cleanEmail}" is already in use.` });
        }
      }
      nextEmail = cleanEmail;
    }

    const updateData: Record<string, any> = {
      name: req.body.name,
      email: nextEmail,
      role: req.body.role,
      schoolId: nextSchoolId,
      updatedAt: new Date(),
    };

    if (req.body.phone !== undefined) {
      updateData.phone = req.body.phone ? String(req.body.phone).trim() : null;
    }

    if (req.body.state !== undefined) {
      updateData.state = req.body.state ? String(req.body.state).trim() : null;
    }

    if (req.body.district !== undefined) {
      updateData.district = req.body.district ? String(req.body.district).trim() : null;
    }

    if (req.body.password && String(req.body.password).trim().length >= 8) {
      const rawPassword = String(req.body.password).trim();
      updateData.passwordHash = await hashPassword(rawPassword);
      updateData.idPass = rawPassword;
    }

    await db.update(users).set(updateData).where(eq(users.id, id));
    await audit(actor, "UPDATE_USER", "user", id, target.schoolId, { ...req.body, password: req.body.password ? "[REDACTED]" : undefined });
    res.json(safeUser((await db.select().from(users).where(eq(users.id, id)))[0]));
  } catch (e) { fail(res, e); }
});

router.patch("/users/:id/status", requireRole(adminRoles), async (req, res) => {
  try {
    const actor = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const target = (await db.select().from(users).where(eq(users.id, id)))[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    await db.update(users).set({ isActive: Boolean(req.body.isActive) }).where(eq(users.id, id));
    await audit(actor, "UPDATE_USER_STATUS", "user", id, target.schoolId, req.body);
    res.json({ success: true });
  } catch (e) { fail(res, e); }
});

router.delete("/users/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const actor = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);

    if (actor.id === id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }

    const target = (await db.select().from(users).where(eq(users.id, id)))[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    // Clean up dependent records referencing this user before deleting
    await db.delete(notifications).where(eq(notifications.userId, id));
    await db.delete(auditLogs).where(eq(auditLogs.userId, id));
    await db.delete(users).where(eq(users.id, id));
    await audit(actor, "DELETE_USER", "user", id, target.schoolId, { openId: target.openId, name: target.name, role: target.role });
    res.status(204).end();
  } catch (e) { fail(res, e); }
});

router.post("/users/:id/credentials", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const target = (await db.select().from(users).where(eq(users.id, id)))[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    const cleanSlug =
      (target.openId || target.name || "PTR")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 8) || "PTR";

    const isExplicitChange = Boolean(req.body.password && String(req.body.password).length >= 8);
    const isExplicitRegenerate = Boolean(req.body.regenerate);

    let rawPassword: string;
    let shouldUpdatePassword = false;

    if (target.idPass && !isExplicitChange && !isExplicitRegenerate) {
      rawPassword = target.idPass;
    } else {
      rawPassword = isExplicitChange
        ? String(req.body.password)
        : `Pass@${cleanSlug}${Math.floor(1000 + Math.random() * 9000)}`;
      shouldUpdatePassword = true;
    }

    if (shouldUpdatePassword) {
      const passwordHash = await hashPassword(rawPassword);
      await db.update(users).set({ passwordHash, idPass: rawPassword, updatedAt: new Date() }).where(eq(users.id, id));
    }
    await audit(currentUser(res), "GENERATE_USER_CREDENTIALS", "user", id, target.schoolId, {
      loginId: target.openId,
      name: target.name,
      role: target.role,
    });

    res.json({
      success: true,
      credentials: {
        loginId: target.openId,
        email: target.email ?? "",
        name: target.name ?? "",
        phone: target.phone ?? "",
        password: rawPassword,
      },
    });
  } catch (e) {
    fail(res, e);
  }
});

export const userRoutes = router;
