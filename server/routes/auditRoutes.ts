import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  auditLogs,
  idCardData,
  idCards,
  idCardTemplates,
  schools,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { adminRoles, currentUser, fail } from "./shared";

const router = Router();

router.get("/audit-logs", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);

    let logEntries: any[] = [];
    if (adminRoles.has(user.role)) {
      if (req.query.schoolId) {
        const sid = Number(req.query.schoolId);
        logEntries = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.schoolId, sid))
          .orderBy(desc(auditLogs.id))
          .limit(200);
      } else {
        logEntries = await db
          .select()
          .from(auditLogs)
          .orderBy(desc(auditLogs.id))
          .limit(200);
      }
    } else {
      // School user: strictly scoped to own school
      if (!user.schoolId) return res.json([]);
      logEntries = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.schoolId, user.schoolId))
        .orderBy(desc(auditLogs.id))
        .limit(200);
    }

    // Fetch related users and schools in batch
    const userIds = Array.from(new Set(logEntries.map((l) => l.userId).filter((id): id is number => typeof id === "number")));
    const schoolIds = Array.from(new Set(logEntries.map((l) => l.schoolId).filter((id): id is number => typeof id === "number")));

    const userMap = new Map<number, { name: string | null; email: string | null; role: string }>();
    if (userIds.length > 0) {
      const uRows = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const u of uRows) userMap.set(u.id, u);
    }

    const schoolMap = new Map<number, { name: string | null; shortCode: string | null }>();
    if (schoolIds.length > 0) {
      const sRows = await db
        .select({ id: schools.id, name: schools.name, shortCode: schools.shortCode })
        .from(schools)
        .where(inArray(schools.id, schoolIds));
      for (const s of sRows) schoolMap.set(s.id, s);
    }

    const rawRows = logEntries.map((l) => {
      const u = l.userId ? userMap.get(l.userId) : null;
      const s = l.schoolId ? schoolMap.get(l.schoolId) : null;
      return {
        id: l.id,
        userId: l.userId,
        userName: u?.name ?? null,
        userEmail: u?.email ?? null,
        userRole: u?.role ?? null,
        actorRole: l.actorRole || u?.role || null,
        schoolId: l.schoolId,
        schoolName: s?.name ?? null,
        schoolCode: s?.shortCode ?? null,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        newValues: l.newValues,
        oldValues: l.oldValues,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      };
    });

    // Post-enrichment for legacy/historical audit logs missing templateName or card details in newValues
    const templateIdsToFetch = new Set<number>();
    const cardIdsToFetch = new Set<number>();

    for (const row of rawRows) {
      const nv = (row.newValues && typeof row.newValues === "object") ? (row.newValues as Record<string, any>) : {};
      if ((row.action === "SELECT_TEMPLATE" || row.action === "UNSELECT_TEMPLATE") && !nv.templateName) {
        const tid = nv.templateId || (row.entityType === "template" ? row.entityId : null);
        if (tid) templateIdsToFetch.add(Number(tid));
      }
      if (
        (row.action === "APPROVE_ID_CARD" || row.action === "REJECT_ID_CARD" || row.action === "REQUEST_CHANGES" || row.action === "START_REVIEW") &&
        (!nv.cardNumber || !nv.studentName)
      ) {
        const cid = row.entityId || nv.cardId;
        if (cid) cardIdsToFetch.add(Number(cid));
      }
    }

    const templateNameMap = new Map<number, string>();
    if (templateIdsToFetch.size > 0) {
      const tRows = await db
        .select({ id: idCardTemplates.id, name: idCardTemplates.name })
        .from(idCardTemplates)
        .where(inArray(idCardTemplates.id, Array.from(templateIdsToFetch)));
      for (const t of tRows) templateNameMap.set(t.id, t.name);
    }

    const cardDetailsMap = new Map<number, { cardNumber?: string; studentName?: string }>();
    if (cardIdsToFetch.size > 0) {
      const cRows = await db
        .select({ id: idCards.id, cardNumber: idCards.cardNumber })
        .from(idCards)
        .where(inArray(idCards.id, Array.from(cardIdsToFetch)));
      for (const c of cRows) cardDetailsMap.set(c.id, { cardNumber: c.cardNumber });

      const dRows = await db
        .select({ idCardId: idCardData.idCardId, fieldKey: idCardData.fieldKey, fieldValue: idCardData.fieldValue })
        .from(idCardData)
        .where(and(inArray(idCardData.idCardId, Array.from(cardIdsToFetch)), inArray(idCardData.fieldKey, ["student_name", "studentName", "name", "full_name"])));
      for (const d of dRows) {
        const existing = cardDetailsMap.get(d.idCardId) || {};
        if (!existing.studentName && d.fieldValue) {
          existing.studentName = d.fieldValue;
          cardDetailsMap.set(d.idCardId, existing);
        }
      }
    }

    const enrichedRows = rawRows.map((row) => {
      const nv = (row.newValues && typeof row.newValues === "object") ? { ...(row.newValues as Record<string, any>) } : {};
      if ((row.action === "SELECT_TEMPLATE" || row.action === "UNSELECT_TEMPLATE") && !nv.templateName) {
        const tid = nv.templateId || (row.entityType === "template" ? row.entityId : null);
        if (tid && templateNameMap.has(Number(tid))) {
          nv.templateName = templateNameMap.get(Number(tid));
        }
      }
      if (
        (row.action === "APPROVE_ID_CARD" || row.action === "REJECT_ID_CARD" || row.action === "REQUEST_CHANGES" || row.action === "START_REVIEW")
      ) {
        const cid = row.entityId || nv.cardId;
        if (cid && cardDetailsMap.has(Number(cid))) {
          const detail = cardDetailsMap.get(Number(cid))!;
          if (!nv.cardNumber && detail.cardNumber) nv.cardNumber = detail.cardNumber;
          if (!nv.studentName && detail.studentName) nv.studentName = detail.studentName;
        }
      }
      const isPartner =
        row.actorRole === "PARTNER" ||
        row.actorRole === "PARTNER_ADMIN" ||
        row.actorRole === "MARKETING_ADMIN" ||
        row.userRole === "PARTNER" ||
        row.userRole === "PARTNER_ADMIN" ||
        row.userRole === "MARKETING_ADMIN" ||
        (nv && typeof nv === "object" && (nv.placedByRole === "PARTNER" || nv.placedByRole === "PARTNER_ADMIN" || nv.placedByRole === "MARKETING_ADMIN"));
      return {
        ...row,
        isPartner,
        isMarketing: isPartner,
        newValues: nv,
      };
    });

    const isPartnerFilter =
      req.query.partner === "1" ||
      req.query.partner === "true" ||
      req.query.marketing === "1" ||
      req.query.marketing === "true";
    const filteredRows = isPartnerFilter ? enrichedRows.filter((r) => r.isPartner) : enrichedRows;

    if (req.query.export === "csv" || req.query.format === "csv") {
      const headers = ["Timestamp", "User", "Role", "Actor Role", "Action", "School", "Entity", "Details"];
      const csvRows = filteredRows.map((r) => [
        `"${r.createdAt ? new Date(r.createdAt).toISOString() : ""}"`,
        `"${(r.userName || r.userEmail || "").replace(/"/g, '""')}"`,
        `"${(r.userRole || "").replace(/"/g, '""')}"`,
        `"${(r.actorRole || "").replace(/"/g, '""')}"`,
        `"${(r.action || "").replace(/"/g, '""')}"`,
        `"${(r.schoolName || "").replace(/"/g, '""')}"`,
        `"${(r.entityType || "")} #${r.entityId || ""}"`,
        `"${JSON.stringify(r.newValues || {}).replace(/"/g, '""')}"`,
      ].join(","));
      const csvContent = [headers.join(","), ...csvRows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="audit_logs_${Date.now()}.csv"`);
      return res.send(csvContent);
    }

    res.json(filteredRows);
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/audit-logs", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);

    if (!adminRoles.has(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions: audit logs cannot be cleared by school users" });
    }

    if (req.query.schoolId) {
      const sid = Number(req.query.schoolId);
      await db.delete(auditLogs).where(eq(auditLogs.schoolId, sid));
    } else {
      await db.delete(auditLogs);
    }
    return res.json({ success: true, message: "Audit logs cleared" });
  } catch (e) {
    fail(res, e);
  }
});

export const auditRoutes = router;
