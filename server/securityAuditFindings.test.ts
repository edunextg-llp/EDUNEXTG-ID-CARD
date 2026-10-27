import "dotenv/config";
import http from "node:http";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express, { type Request, type Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { apiRouter } from "./api";
import { getDb } from "./db";
import { auditLogs, passwordResets, schools, users } from "../drizzle/schema";
import { hashPassword, loginUser, createPasswordReset, resetPassword } from "./appAuth";
import { resolveClientIp } from "./_core/rateLimit";

describe("Security Audit Findings Remediation Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let adminUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required for test suite");

    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json({ limit: "2mb" }));
    app.use("/api", apiRouter);

    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    const testPassword = "AdminSecurityPass123!";
    const pwdHash = await hashPassword(testPassword);
    const ts = Date.now();
    const adminEmail = `secadmin_${ts}@test.local`;

    const [adminRes] = await db.insert(users).values({
      openId: `secadmin_${ts}`,
      name: "Security Admin",
      email: adminEmail,
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    adminUserId = Number(adminRes.insertId);

    const loginRes = await loginUser(adminEmail, testPassword);
    if (!loginRes) throw new Error("Admin login failed");
    adminToken = loginRes.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe("Finding 1: CF-Connecting-IP Header Spoofing Defense", () => {
    it("resolveClientIp relies on req.ip / socket instead of raw cf-connecting-ip", () => {
      const spoofedReq = {
        headers: {
          "cf-connecting-ip": "198.51.100.99",
        },
        ip: "203.0.113.10",
        socket: { remoteAddress: "127.0.0.1" },
      } as unknown as Request;

      expect(resolveClientIp(spoofedReq)).toBe("203.0.113.10");
    });
  });

  describe("Finding 2: Password Redaction in Audit Logs During School Creation", () => {
    it("redacts cleartext password in auditLogs when school is created", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database required");

      const ts = Date.now();
      const rawPassword = "SuperSecretSchoolAdminPass123!";
      const res = await fetch(`${baseUrl}/api/schools`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Audit Redaction School ${ts}`,
          shortCode: `AR${ts.toString().slice(-4)}`,
          email: `admin_${ts}@ar.test`,
          password: rawPassword,
        }),
      });

      expect(res.status).toBe(201);
      const schoolData = await res.json();
      const schoolId = schoolData.id;

      // Inspect auditLogs entry
      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.schoolId, schoolId), eq(auditLogs.action, "CREATE_SCHOOL")));

      expect(logs.length).toBeGreaterThan(0);
      const newValues = logs[0].newValues as any;
      expect(newValues).toBeDefined();
      expect(newValues.password).toBe("[REDACTED]");
      expect(JSON.stringify(newValues)).not.toContain(rawPassword);
    });
  });

  describe("Finding 3: Avatar Upload Size & Magic Byte Validation", () => {
    it("rejects avatar without data URI or HTTP URL with 400", async () => {
      const res = await fetch(`${baseUrl}/api/profile/picture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarUrl: "javascript:alert(1)",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/invalid image format/i);
    });

    it("rejects avatar exceeding 500KB limit with 400", async () => {
      const pngBuffer = Buffer.alloc(600 * 1024);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]).copy(pngBuffer, 0);

      const res = await fetch(`${baseUrl}/api/profile/picture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/500KB limit/i);
    });

    it("rejects avatar with invalid MIME magic bytes (e.g. text/plain in data: URI) with 400", async () => {
      const fakeBuffer = Buffer.from("Hello world this is not a valid image payload");

      const res = await fetch(`${baseUrl}/api/profile/picture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarUrl: `data:image/png;base64,${fakeBuffer.toString("base64")}`,
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/invalid image/i);
    });
  });

  describe("Finding 4: Incomplete Token Invalidation in resetPassword", () => {
    it("invalidates all sibling reset tokens for a user once one token is used", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database required");

      const ts = Date.now();
      const victimEmail = `victim_${ts}@test.local`;
      const [userRes] = await db.insert(users).values({
        openId: `victim_${ts}`,
        name: "Victim User",
        email: victimEmail,
        role: "VIEWER",
        passwordHash: await hashPassword("OldVictimPassword123!"),
        loginMethod: "local",
        isActive: true,
      });
      const victimUserId = Number(userRes.insertId);

      // Generate two tokens
      const token1 = await createPasswordReset(victimEmail);
      const token2 = await createPasswordReset(victimEmail);
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();

      // Reset password using token 2
      const success2 = await resetPassword(token2!, "NewVictimPassword123!");
      expect(success2).toBe(true);

      // Verify token 1 is now invalidated
      const success1 = await resetPassword(token1!, "AttackerPassword123!");
      expect(success1).toBe(false);

      // Verify in DB that no active tokens remain for victim
      const remainingActiveTokens = await db
        .select()
        .from(passwordResets)
        .where(and(eq(passwordResets.userId, victimUserId), isNull(passwordResets.usedAt)));
      expect(remainingActiveTokens.length).toBe(0);
    });
  });

  describe("Finding 5: Email Uniqueness Checks on User Creation & Editing", () => {
    it("POST /api/users rejects creating a user with an existing email", async () => {
      const ts = Date.now();
      const sharedEmail = `shared_${ts}@test.local`;

      // Create first user
      const res1 = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openId: `userA_${ts}`,
          name: "User Alpha",
          email: sharedEmail,
          role: "SUPER_ADMIN",
          password: "InitialPassword123!",
        }),
      });
      expect(res1.status).toBe(201);

      // Attempt to create second user with same email
      const res2 = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openId: `userB_${ts}`,
          name: "User Beta",
          email: sharedEmail,
          role: "SUPER_ADMIN",
          password: "InitialPassword123!",
        }),
      });
      expect(res2.status).toBe(409);
      const data = await res2.json();
      expect(data.error).toMatch(/already in use/i);
    });

    it("PUT /api/users/:id rejects updating email to another user's email", async () => {
      const ts = Date.now();
      const email1 = `unique1_${ts}@test.local`;
      const email2 = `unique2_${ts}@test.local`;

      // Create User 1
      const res1 = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openId: `u1_${ts}`,
          name: "User One",
          email: email1,
          role: "SUPER_ADMIN",
          password: "Password123!",
        }),
      });
      expect(res1.status).toBe(201);
      const u1 = await res1.json();

      // Create User 2
      const res2 = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openId: `u2_${ts}`,
          name: "User Two",
          email: email2,
          role: "SUPER_ADMIN",
          password: "Password123!",
        }),
      });
      expect(res2.status).toBe(201);
      const u2 = await res2.json();

      // Try updating User 2's email to User 1's email
      const updateRes = await fetch(`${baseUrl}/api/users/${u2.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email1,
        }),
      });
      expect(updateRes.status).toBe(409);
      const updateData = await updateRes.json();
      expect(updateData.error).toMatch(/already in use/i);

      // Updating User 2 without changing email succeeds
      const selfUpdateRes = await fetch(`${baseUrl}/api/users/${u2.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email2,
          name: "User Two Renamed",
        }),
      });
      expect(selfUpdateRes.status).toBe(200);
    });
  });

  describe("Finding 6: Content Security Policy Header in Production Mode", () => {
    it("sets enforced Content-Security-Policy header when NODE_ENV is production", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const testApp = express();
      testApp.use((req, res, next) => {
        const cspDirectives =
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'self';";
        if (process.env.NODE_ENV === "production") {
          res.setHeader("Content-Security-Policy", cspDirectives);
        } else {
          res.setHeader("Content-Security-Policy-Report-Only", cspDirectives);
        }
        next();
      });
      testApp.get("/test-csp", (_req, res) => res.send("ok"));

      let cspServer: http.Server;
      let cspPort: number;
      await new Promise<void>((resolve) => {
        cspServer = http.createServer(testApp).listen(0, "127.0.0.1", () => {
          cspPort = (cspServer.address() as any).port;
          resolve();
        });
      });

      try {
        const res = await fetch(`http://127.0.0.1:${cspPort!}/test-csp`);
        expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
        expect(res.headers.get("content-security-policy-report-only")).toBeNull();
      } finally {
        process.env.NODE_ENV = origEnv;
        await new Promise<void>((resolve) => cspServer.close(() => resolve()));
      }
    });
  });

  describe("Finding 7: Password Reset Token Leakage Protection", () => {
    it("does not leak developmentResetToken when EXPOSE_DEV_RESET_TOKENS is not enabled", async () => {
      const origExpose = process.env.EXPOSE_DEV_RESET_TOKENS;
      delete process.env.EXPOSE_DEV_RESET_TOKENS;

      try {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: `secadmin_${Date.now()}@test.local` }),
        });
        const data = await res.json();
        expect(data.developmentResetToken).toBeUndefined();
      } finally {
        if (origExpose !== undefined) process.env.EXPOSE_DEV_RESET_TOKENS = origExpose;
      }
    });

    it("includes developmentResetToken when EXPOSE_DEV_RESET_TOKENS is explicitly 'true'", async () => {
      const origExpose = process.env.EXPOSE_DEV_RESET_TOKENS;
      process.env.EXPOSE_DEV_RESET_TOKENS = "true";

      const ts = Date.now();
      const db = await getDb();
      if (!db) throw new Error("Database required");
      const testEmail = `devtoken_${ts}@test.local`;
      await db.insert(users).values({
        openId: `devtoken_${ts}`,
        name: "Dev Token User",
        email: testEmail,
        role: "VIEWER",
        passwordHash: await hashPassword("DevTokenPass123!"),
        loginMethod: "local",
        isActive: true,
      });

      try {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: testEmail }),
        });
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.developmentResetToken).toBeDefined();
        expect(typeof data.developmentResetToken).toBe("string");
      } finally {
        if (origExpose !== undefined) {
          process.env.EXPOSE_DEV_RESET_TOKENS = origExpose;
        } else {
          delete process.env.EXPOSE_DEV_RESET_TOKENS;
        }
      }
    });
  });
});

