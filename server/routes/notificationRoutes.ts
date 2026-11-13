import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { notifications } from "../../drizzle/schema";
import { getDb } from "../db";
import { currentUser, fail } from "./shared";

const router = Router();

router.get("/notifications", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    res.json(
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, currentUser(res).id))
        .orderBy(desc(notifications.createdAt)),
    );
  } catch (e) {
    fail(res, e);
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, currentUser(res).id)));
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/notifications", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);
    await db.delete(notifications).where(eq(notifications.userId, user.id));
    res.json({ success: true, message: "Notifications cleared" });
  } catch (e) {
    fail(res, e);
  }
});

export const notificationRoutes = router;
