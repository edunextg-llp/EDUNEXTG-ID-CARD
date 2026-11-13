import { Router } from "express";
import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import {
  notifications,
  orders,
  schools,
  users,
  type Order,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { isValidIndianMobileNumber, INDIAN_MOBILE_ERROR_MESSAGE } from "../../shared/phoneValidation";
import { HOOK_TYPES, CARD_MATERIALS, ORDER_TYPES, PRINT_SIDES, ORDER_STATUSES } from "../../shared/orders";
import {
  adminRoles,
  audit,
  currentUser,
  fail,
  orderRoles,
  requireRole,
} from "./shared";

const router = Router();

// ─── ORDERS MODULE ────────────────────────────────────────────────────────
router.get("/orders/schools", requireRole(orderRoles), async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const activeSchools = await db
      .select({
        id: schools.id,
        name: schools.name,
        shortCode: schools.shortCode,
        isActive: schools.isActive,
      })
      .from(schools)
      .where(eq(schools.isActive, true))
      .orderBy(schools.name);
    res.json(activeSchools);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/orders", requireRole(orderRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const {
      orderType,
      hookType,
      clip,
      className,
      section,
      quantity,
      printSides,
      cardMaterial,
      lanyardIncluded,
      lanyardColor,
      neededByDate,
      deliveryAddress,
      contactPerson,
      contactPhone,
      notes,
    } = req.body || {};

    if (!orderType || (orderType !== "STUDENT" && orderType !== "STAFF")) {
      return res.status(400).json({ error: "orderType must be 'STUDENT' or 'STAFF'" });
    }

    let targetSchoolId: number;
    if (user.role === "SCHOOL_ADMIN") {
      if (!user.schoolId) {
        return res.status(403).json({ error: "School admin must belong to a school" });
      }
      targetSchoolId = user.schoolId;
    } else {
      if (!req.body?.schoolId) {
        return res.status(400).json({ error: "schoolId is required" });
      }
      targetSchoolId = Number(req.body.schoolId);
      if (!Number.isInteger(targetSchoolId) || targetSchoolId <= 0) {
        return res.status(400).json({ error: "Valid schoolId is required" });
      }
      const [school] = await db
        .select()
        .from(schools)
        .where(and(eq(schools.id, targetSchoolId), eq(schools.isActive, true)));
      if (!school) {
        return res.status(400).json({ error: "Selected school does not exist or is not active" });
      }
    }

    // Validation for STUDENT vs STAFF
    if (orderType === "STUDENT") {
      if (!className || typeof className !== "string" || !className.trim()) {
        return res.status(400).json({ error: "className is required for STUDENT orders" });
      }
      if (!section || typeof section !== "string" || !section.trim()) {
        return res.status(400).json({ error: "section is required for STUDENT orders" });
      }
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10000) {
      return res.status(400).json({ error: "quantity must be an integer between 1 and 10,000" });
    }

    if (!hookType || !HOOK_TYPES.includes(hookType as any)) {
      return res.status(400).json({ error: `hookType must be one of: ${HOOK_TYPES.join(", ")}` });
    }

    const validPrintSides = PRINT_SIDES.map((s) => s.value);
    if (!printSides || !validPrintSides.includes(printSides as any)) {
      return res.status(400).json({ error: `printSides must be one of: ${validPrintSides.join(", ")}` });
    }

    const validMaterials = CARD_MATERIALS.map((m) => m.value);
    if (!cardMaterial || !validMaterials.includes(cardMaterial as any)) {
      return res.status(400).json({ error: `cardMaterial must be one of: ${validMaterials.join(", ")}` });
    }

    if (!deliveryAddress || typeof deliveryAddress !== "string" || deliveryAddress.trim().length < 3) {
      return res.status(400).json({ error: "deliveryAddress must be at least 3 characters" });
    }

    if (!contactPerson || typeof contactPerson !== "string" || contactPerson.trim().length < 2) {
      return res.status(400).json({ error: "contactPerson must be at least 2 characters" });
    }

    if (!isValidIndianMobileNumber(contactPhone, false)) {
      return res.status(400).json({ error: INDIAN_MOBILE_ERROR_MESSAGE });
    }

    let createdOrder: Order;
    await db.transaction(async (tx) => {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const prefix = `ORD-${todayStr}-`;
      const todaysOrders = await tx
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(like(orders.orderNumber, `${prefix}%`));

      let maxSeq = 0;
      for (const ord of todaysOrders) {
        const parts = ord.orderNumber.split("-");
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
      const orderNumber = `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;

      const [insertResult] = await tx.insert(orders).values({
        orderNumber,
        placedByUserId: user.id,
        placedByRole: user.role,
        placedByName: user.name || "User",
        schoolId: targetSchoolId,
        orderType,
        className: orderType === "STUDENT" ? String(className).trim() : null,
        section: orderType === "STUDENT" ? String(section).trim() : null,
        quantity: qty,
        hookType: String(hookType),
        clip: Boolean(clip),
        printSides,
        cardMaterial,
        lanyardIncluded: Boolean(lanyardIncluded),
        lanyardColor: lanyardColor ? String(lanyardColor).trim() : null,
        neededByDate: neededByDate ? String(neededByDate).trim() : null,
        deliveryAddress: String(deliveryAddress).trim(),
        contactPerson: String(contactPerson).trim(),
        contactPhone: String(contactPhone).trim(),
        notes: notes ? String(notes).trim() : null,
        status: "PLACED",
      });

      const orderId = Number(insertResult.insertId);
      const [ord] = await tx.select().from(orders).where(eq(orders.id, orderId));
      createdOrder = ord;

      // School info for notification
      const [school] = await tx.select().from(schools).where(eq(schools.id, targetSchoolId));
      const schoolName = school?.name || `School #${targetSchoolId}`;

      // Notify all active super admins
      const superAdmins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "SUPER_ADMIN"), eq(users.isActive, true)));

      for (const sa of superAdmins) {
        await tx.insert(notifications).values({
          userId: sa.id,
          schoolId: targetSchoolId,
          title: "New ID Card Order Placed",
          message: `New order ${orderNumber} from ${user.name} (${user.role}) for ${schoolName}: ${qty} cards`,
          type: "INFO",
        });
      }
    });

    await audit(user, "PLACE_ORDER", "order", createdOrder!.id, targetSchoolId, {
      orderNumber: createdOrder!.orderNumber,
      quantity: createdOrder!.quantity,
      orderType: createdOrder!.orderType,
      placedByRole: user.role,
    });

    res.status(201).json(createdOrder!);
  } catch (e) {
    fail(res, e);
  }
});

router.get("/orders", requireRole(orderRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const conditions: any[] = [];

    // Role-based visibility
    if (user.role === "SUPER_ADMIN") {
      if (req.query.schoolId) {
        conditions.push(eq(orders.schoolId, Number(req.query.schoolId)));
      }
    } else if (user.role === "SCHOOL_ADMIN") {
      if (!user.schoolId) return res.json({ items: [], total: 0, page: 1, pageSize: 10 });
      conditions.push(eq(orders.schoolId, user.schoolId));
    } else if (user.role === "PARTNER" || user.role === "PARTNER_ADMIN" || user.role === "MARKETING_ADMIN") {
      conditions.push(eq(orders.placedByUserId, user.id));
    }

    if (req.query.status && ORDER_STATUSES.some((s) => s.value === req.query.status)) {
      conditions.push(eq(orders.status, req.query.status as any));
    }

    if (req.query.orderType && ORDER_TYPES.some((t) => t.value === req.query.orderType)) {
      conditions.push(eq(orders.orderType, req.query.orderType as any));
    }

    if (req.query.placedByRole) {
      if (req.query.placedByRole === "PARTNER" || req.query.placedByRole === "MARKETING_ADMIN") {
        conditions.push(or(eq(orders.placedByRole, "PARTNER"), eq(orders.placedByRole, "PARTNER_ADMIN"), eq(orders.placedByRole, "MARKETING_ADMIN")));
      } else {
        conditions.push(eq(orders.placedByRole, String(req.query.placedByRole)));
      }
    }

    if (req.query.from) {
      const fromDate = new Date(String(req.query.from));
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(orders.createdAt, fromDate));
      }
    }
    if (req.query.to) {
      const toDate = new Date(String(req.query.to));
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        conditions.push(lte(orders.createdAt, toDate));
      }
    }

    if (req.query.search) {
      const q = `%${String(req.query.search).trim()}%`;
      conditions.push(
        or(
          like(orders.orderNumber, q),
          like(schools.name, q),
          like(orders.placedByName, q)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ total: sql<number>`count(*)` })
      .from(orders)
      .leftJoin(schools, eq(orders.schoolId, schools.id))
      .where(whereClause);
    const total = Number(countResult?.total ?? 0);

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const rawPageSize = parseInt(String(req.query.pageSize || "10"), 10);
    const pageSize = [10, 25, 50, 100].includes(rawPageSize) ? rawPageSize : 10;
    const offset = (page - 1) * pageSize;

    const items = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        placedByUserId: orders.placedByUserId,
        placedByRole: orders.placedByRole,
        placedByName: orders.placedByName,
        schoolId: orders.schoolId,
        schoolName: schools.name,
        orderType: orders.orderType,
        hookType: orders.hookType,
        clip: orders.clip,
        className: orders.className,
        section: orders.section,
        quantity: orders.quantity,
        printSides: orders.printSides,
        cardMaterial: orders.cardMaterial,
        lanyardIncluded: orders.lanyardIncluded,
        lanyardColor: orders.lanyardColor,
        neededByDate: orders.neededByDate,
        deliveryAddress: orders.deliveryAddress,
        contactPerson: orders.contactPerson,
        contactPhone: orders.contactPhone,
        notes: orders.notes,
        status: orders.status,
        statusNote: orders.statusNote,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .leftJoin(schools, eq(orders.schoolId, schools.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.json({ items, total, page, pageSize });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/orders/:id", requireRole(orderRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "Order not found" });

    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        placedByUserId: orders.placedByUserId,
        placedByRole: orders.placedByRole,
        placedByName: orders.placedByName,
        schoolId: orders.schoolId,
        schoolName: schools.name,
        orderType: orders.orderType,
        hookType: orders.hookType,
        clip: orders.clip,
        className: orders.className,
        section: orders.section,
        quantity: orders.quantity,
        printSides: orders.printSides,
        cardMaterial: orders.cardMaterial,
        lanyardIncluded: orders.lanyardIncluded,
        lanyardColor: orders.lanyardColor,
        neededByDate: orders.neededByDate,
        deliveryAddress: orders.deliveryAddress,
        contactPerson: orders.contactPerson,
        contactPhone: orders.contactPhone,
        notes: orders.notes,
        status: orders.status,
        statusNote: orders.statusNote,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .leftJoin(schools, eq(orders.schoolId, schools.id))
      .where(eq(orders.id, id));

    if (!order) return res.status(404).json({ error: "Order not found" });

    // Check visibility
    if (user.role === "SUPER_ADMIN") {
      return res.json(order);
    }
    if (user.role === "SCHOOL_ADMIN" && order.schoolId === user.schoolId) {
      return res.json(order);
    }
    if ((user.role === "PARTNER" || user.role === "PARTNER_ADMIN" || user.role === "MARKETING_ADMIN") && order.placedByUserId === user.id) {
      return res.json(order);
    }

    return res.status(404).json({ error: "Order not found" });
  } catch (e) {
    fail(res, e);
  }
});

router.patch("/orders/:id/status", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const { status, statusNote } = req.body || {};

    const validStatuses = ORDER_STATUSES.map((s) => s.value);
    if (!status || !validStatuses.includes(status as any)) {
      return res.status(400).json({ error: `Valid status required: ${validStatuses.join(", ")}` });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return res.status(404).json({ error: "Order not found" });

    const cleanNote = statusNote ? String(statusNote).trim() : null;
    await db
      .update(orders)
      .set({
        status,
        statusNote: cleanNote,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    // Notify order placer if exists
    if (order.placedByUserId) {
      await db.insert(notifications).values({
        userId: order.placedByUserId,
        schoolId: order.schoolId,
        title: "Order Status Updated",
        message: `Order ${order.orderNumber} status updated to ${status}${cleanNote ? ": " + cleanNote : ""}`,
        type: "INFO",
      });
    }

    await audit(user, "UPDATE_ORDER_STATUS", "order", id, order.schoolId, {
      orderNumber: order.orderNumber,
      fromStatus: order.status,
      toStatus: status,
      statusNote: cleanNote,
    });

    const [updated] = await db.select().from(orders).where(eq(orders.id, id));
    res.json(updated);
  } catch (e) {
    fail(res, e);
  }
});

router.patch("/orders/:id/cancel", requireRole(orderRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);

    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Authorization: SUPER_ADMIN any time; placer only while PLACED
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const isPlacer = order.placedByUserId === user.id;

    if (!isSuperAdmin && !isPlacer) {
      return res.status(403).json({ error: "You do not have permission to cancel this order" });
    }

    if (!isSuperAdmin && order.status !== "PLACED") {
      return res.status(400).json({ error: "Orders can only be cancelled while status is PLACED" });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({ error: "Order is already cancelled" });
    }
    if (order.status === "DELIVERED") {
      return res.status(400).json({ error: "Delivered orders cannot be cancelled" });
    }

    const cancelNote = req.body?.statusNote
      ? String(req.body.statusNote).trim()
      : isSuperAdmin
      ? "Cancelled by Admin"
      : `Cancelled by placer ${user.name}`;

    await db
      .update(orders)
      .set({
        status: "CANCELLED",
        statusNote: cancelNote,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    // Notify: if super admin cancelled, notify placer; if placer cancelled, notify super admins
    if (isSuperAdmin && order.placedByUserId) {
      await db.insert(notifications).values({
        userId: order.placedByUserId,
        schoolId: order.schoolId,
        title: "Order Cancelled",
        message: `Your order ${order.orderNumber} was cancelled by Admin. Note: ${cancelNote}`,
        type: "WARNING",
      });
    } else if (isPlacer) {
      const superAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "SUPER_ADMIN"), eq(users.isActive, true)));
      for (const sa of superAdmins) {
        await db.insert(notifications).values({
          userId: sa.id,
          schoolId: order.schoolId,
          title: "Order Cancelled by Placer",
          message: `Order ${order.orderNumber} was cancelled by ${user.name} (${user.role})`,
          type: "INFO",
        });
      }
    }

    await audit(user, "CANCEL_ORDER", "order", id, order.schoolId, {
      orderNumber: order.orderNumber,
      previousStatus: order.status,
      statusNote: cancelNote,
    });

    const [updated] = await db.select().from(orders).where(eq(orders.id, id));
    res.json(updated);
  } catch (e) {
    fail(res, e);
  }
});

export const orderRoutes = router;
