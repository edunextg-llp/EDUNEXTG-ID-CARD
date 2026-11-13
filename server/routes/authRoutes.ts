import { Router } from "express";
import { eq } from "drizzle-orm";
import { schools } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import {
  checkAccountLockout,
  recordAccountLoginFailure,
  resetAccountLoginFailure,
  resolveClientIp,
} from "../_core/rateLimit";
import {
  authenticateApplicationRequest,
  clearApplicationSession,
  createPasswordReset,
  loginUser,
  resetPassword,
  setApplicationSession,
} from "../appAuth";
import { fail } from "./shared";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.username ?? req.body.email ?? "").trim();
    const password = String(req.body.password ?? "");
    if (!identifier || password.length < 8) return res.status(400).json({ error: "Valid username/email and password are required" });

    const clientIp = resolveClientIp(req);
    const lockout = checkAccountLockout(identifier, clientIp);
    if (lockout.locked) {
      if (!res.headersSent) {
        res.setHeader("Retry-After", lockout.retryAfterSeconds);
        res.setHeader("RateLimit-Limit", 10);
        res.setHeader("RateLimit-Remaining", 0);
        res.setHeader("RateLimit-Reset", lockout.retryAfterSeconds);
      }
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const result = await loginUser(identifier, password);
    if (!result) {
      recordAccountLoginFailure(identifier, clientIp);
      return res.status(401).json({ error: "Invalid username or password" });
    }
    resetAccountLoginFailure(identifier, clientIp);
    setApplicationSession(res, result.token);
    const { passwordHash: _passwordHash, idPass: _idPass, ...safeUser } = result.user;
    const db = await getDb();
    const school = safeUser.schoolId && db ? (await db.select({ name: schools.name }).from(schools).where(eq(schools.id, safeUser.schoolId)))[0] : undefined;
    res.json({ user: { ...safeUser, schoolName: school?.name ?? null } });
  } catch (e: any) {
    if (e?.isSchoolInactive) {
      return res.status(403).json({ error: e.message });
    }
    fail(res, e);
  }
});

router.post("/auth/logout", (_req, res) => {
  clearApplicationSession(res);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.json({ success: true });
});

router.get("/auth/me", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  try {
    const user = await authenticateApplicationRequest(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const { passwordHash: _passwordHash, idPass: _idPass, ...safeUser } = user;
    const db = await getDb();
    const school = safeUser.schoolId && db ? (await db.select({ name: schools.name }).from(schools).where(eq(schools.id, safeUser.schoolId)))[0] : undefined;
    res.json({ ...safeUser, schoolName: school?.name ?? null });
  } catch {
    res.status(401).json({ error: "Authentication required" });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });
    const token = await createPasswordReset(email);
    const exposeDevToken = process.env.EXPOSE_DEV_RESET_TOKENS === "true" && !ENV.isProduction;
    res.json({ success: true, ...(exposeDevToken && token ? { developmentResetToken: token } : {}) });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token ?? "");
    const password = String(req.body.password ?? "");
    if (!token || password.length < 8) return res.status(400).json({ error: "Token and a password of at least 8 characters are required" });
    const success = await resetPassword(token, password);
    if (!success) return res.status(400).json({ error: "Invalid or expired reset token" });
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

export const authRoutes = router;
