import { Router } from "express";
import { and, desc, eq, gte, isNull, like, lte, or, sql } from "drizzle-orm";
import {
  idCards,
  idCardTemplates,
  removedCardsHistory,
  schools,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { heavyOperationsLimiter } from "../_core/rateLimit";
import { adminRoles, currentUser, fail, requireRole, schoolManagerRoles } from "./shared";

const router = Router();

// ─── REPORTS: REMOVED CARDS HISTORY ───────────────────────────────────────
router.get("/reports/removed-cards", requireRole(schoolManagerRoles), heavyOperationsLimiter, async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);

    const conditions: any[] = [];

    // School scoping: SUPER_ADMIN can filter by schoolId; SCHOOL_ADMIN is locked to own school
    if (adminRoles.has(user.role)) {
      if (req.query.schoolId) {
        conditions.push(eq(removedCardsHistory.schoolId, Number(req.query.schoolId)));
      }
    } else {
      if (!user.schoolId) return res.json({ items: [], total: 0, page: 1, pageSize: 10, classes: [], sections: [], classCounts: [], sectionCounts: [] });
      conditions.push(eq(removedCardsHistory.schoolId, user.schoolId));
    }

    // Card Type scoping: 'student' or 'staff'
    const cardTypeFilter = req.query.cardType === "staff" ? "staff" : req.query.cardType === "student" ? "student" : null;
    if (cardTypeFilter === "staff") {
      conditions.push(eq(idCardTemplates.cardType, "staff"));
    } else if (cardTypeFilter === "student") {
      conditions.push(or(eq(idCardTemplates.cardType, "student"), isNull(idCardTemplates.cardType)));
    }

    if (req.query.className) {
      conditions.push(eq(removedCardsHistory.className, String(req.query.className).trim()));
    }
    if (req.query.section) {
      conditions.push(eq(removedCardsHistory.section, String(req.query.section).trim()));
    }
    if (req.query.search) {
      const q = `%${String(req.query.search).trim()}%`;
      conditions.push(
        or(
          like(removedCardsHistory.cardNumber, q),
          like(removedCardsHistory.studentName, q),
          like(removedCardsHistory.removedByName, q)
        )
      );
    }
    if (req.query.from) {
      const fromDate = new Date(String(req.query.from));
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(removedCardsHistory.removedAt, fromDate));
      }
    }
    if (req.query.to) {
      const toDate = new Date(String(req.query.to));
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        conditions.push(lte(removedCardsHistory.removedAt, toDate));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count for current filter
    const [countResult] = await db
      .select({ total: sql<number>`count(*)` })
      .from(removedCardsHistory)
      .leftJoin(idCards, eq(removedCardsHistory.idCardId, idCards.id))
      .leftJoin(idCardTemplates, eq(idCards.templateId, idCardTemplates.id))
      .where(whereClause);
    const total = Number(countResult?.total ?? 0);

    const baseQuery = db
      .select({
        id: removedCardsHistory.id,
        idCardId: removedCardsHistory.idCardId,
        schoolId: removedCardsHistory.schoolId,
        schoolName: schools.name,
        cardNumber: removedCardsHistory.cardNumber,
        studentName: removedCardsHistory.studentName,
        className: removedCardsHistory.className,
        section: removedCardsHistory.section,
        templateName: removedCardsHistory.templateName,
        previousStatus: removedCardsHistory.previousStatus,
        removedByUserId: removedCardsHistory.removedByUserId,
        removedByName: removedCardsHistory.removedByName,
        removedByRole: removedCardsHistory.removedByRole,
        removedAt: removedCardsHistory.removedAt,
        cardType: idCardTemplates.cardType,
      })
      .from(removedCardsHistory)
      .leftJoin(schools, eq(removedCardsHistory.schoolId, schools.id))
      .leftJoin(idCards, eq(removedCardsHistory.idCardId, idCards.id))
      .leftJoin(idCardTemplates, eq(idCards.templateId, idCardTemplates.id))
      .where(whereClause)
      .orderBy(desc(removedCardsHistory.removedAt));

    // CSV export
    if (req.query.export === "csv" || req.query.format === "csv") {
      const allRows = await baseQuery;
      const isStaffCsv = cardTypeFilter === "staff";
      const headers = isStaffCsv
        ? ["#", "Card No", "Staff Name", "Designation/Department", "School", "Template", "Previous Status", "Removed By", "Removed On"]
        : ["#", "Card No", "Student Name", "Class", "Section", "School", "Template", "Previous Status", "Removed By", "Removed On"];
      const csvRows = allRows.map((r, i) => {
        if (isStaffCsv) {
          return [
            i + 1,
            `"${(r.cardNumber || "").replace(/"/g, '""')}"`,
            `"${(r.studentName || "").replace(/"/g, '""')}"`,
            `"${(r.className || "").replace(/"/g, '""')}"`,
            `"${(r.schoolName || "").replace(/"/g, '""')}"`,
            `"${(r.templateName || "").replace(/"/g, '""')}"`,
            `"${(r.previousStatus || "").replace(/"/g, '""')}"`,
            `"${(r.removedByName || "").replace(/"/g, '""')}"`,
            `"${r.removedAt ? new Date(r.removedAt).toISOString() : ""}"`,
          ].join(",");
        }
        return [
          i + 1,
          `"${(r.cardNumber || "").replace(/"/g, '""')}"`,
          `"${(r.studentName || "").replace(/"/g, '""')}"`,
          `"${(r.className || "").replace(/"/g, '""')}"`,
          `"${(r.section || "").replace(/"/g, '""')}"`,
          `"${(r.schoolName || "").replace(/"/g, '""')}"`,
          `"${(r.templateName || "").replace(/"/g, '""')}"`,
          `"${(r.previousStatus || "").replace(/"/g, '""')}"`,
          `"${(r.removedByName || "").replace(/"/g, '""')}"`,
          `"${r.removedAt ? new Date(r.removedAt).toISOString() : ""}"`,
        ].join(",");
      });
      const csvContent = [headers.join(","), ...csvRows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="removed_${cardTypeFilter || "all"}_cards_history_${Date.now()}.csv"`);
      return res.send(csvContent);
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const rawPageSize = parseInt(String(req.query.pageSize || "10"), 10);
    const pageSize = rawPageSize > 0 && rawPageSize <= 100 ? rawPageSize : 10;
    const offset = (page - 1) * pageSize;

    const items = await baseQuery.limit(pageSize).offset(offset);

    // Summary strip counts
    const summaryConditions: any[] = [];
    if (adminRoles.has(user.role)) {
      if (req.query.schoolId) {
        summaryConditions.push(eq(removedCardsHistory.schoolId, Number(req.query.schoolId)));
      }
    } else if (user.schoolId) {
      summaryConditions.push(eq(removedCardsHistory.schoolId, user.schoolId));
    }
    if (cardTypeFilter === "staff") {
      summaryConditions.push(eq(idCardTemplates.cardType, "staff"));
    } else if (cardTypeFilter === "student") {
      summaryConditions.push(or(eq(idCardTemplates.cardType, "student"), isNull(idCardTemplates.cardType)));
    }

    const summaryWhere = summaryConditions.length > 0 ? and(...summaryConditions) : undefined;

    const summaryRows = await db
      .select({
        className: removedCardsHistory.className,
        section: removedCardsHistory.section,
      })
      .from(removedCardsHistory)
      .leftJoin(idCards, eq(removedCardsHistory.idCardId, idCards.id))
      .leftJoin(idCardTemplates, eq(idCards.templateId, idCardTemplates.id))
      .where(summaryWhere);

    const classSet = new Set<string>();
    const sectionSet = new Set<string>();
    const classCountMap: Record<string, number> = {};
    const sectionCountMap: Record<string, number> = {};

    for (const r of summaryRows) {
      if (r.className && r.className.trim()) {
        const c = r.className.trim();
        classSet.add(c);
        classCountMap[c] = (classCountMap[c] || 0) + 1;
      }
      if (r.section && r.section.trim()) {
        const s = r.section.trim();
        sectionSet.add(s);
        sectionCountMap[s] = (sectionCountMap[s] || 0) + 1;
      }
    }

    const classCounts = Object.entries(classCountMap).map(([className, count]) => ({ className, count }));
    const sectionCounts = Object.entries(sectionCountMap).map(([section, count]) => ({ section, count }));

    res.json({
      items,
      total,
      page,
      pageSize,
      classes: Array.from(classSet).sort(),
      sections: Array.from(sectionSet).sort(),
      classCounts,
      sectionCounts,
    });
  } catch (e) {
    fail(res, e);
  }
});

export const reportRoutes = router;
