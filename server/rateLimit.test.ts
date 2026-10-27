import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { createRateLimiter, isRateLimitDisabled } from "./_core/rateLimit";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { hashPassword } from "./appAuth";
import { eq } from "drizzle-orm";

describe("Login & Auth Rate Limiting Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof getDb>>;

  const existingEmail = `ratelimit_user_${Date.now()}@test.local`;
  const existingPassword = "CorrectPassword123!";
  let existingUserId: number | undefined;

  beforeAll(async () => {
    // Explicitly enable rate limiting for this test suite
    process.env.DISABLE_RATE_LIMIT = "0";

    db = await getDb();
    if (!db) throw new Error("Database required for test");

    const pwdHash = await hashPassword(existingPassword);
    const [inserted] = await db.insert(users).values({
      openId: `ratelimit_user_${Date.now()}`,
      email: existingEmail,
      name: "Rate Limit Test User",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    existingUserId = Number(inserted.insertId);

    const app = express();
    app.use(express.json());

    // Replicate separate limiter instances matching server/_core/index.ts
    app.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    app.use("/api/auth/forgot-password", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }));
    app.use("/api/auth/reset-password", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }));
    app.use("/api", apiRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Server failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    // Restore DISABLE_RATE_LIMIT
    process.env.DISABLE_RATE_LIMIT = "1";
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (db && existingUserId) {
      await db.delete(users).where(eq(users.id, existingUserId));
    }
  });

  it("51st login request from one IP in the window returns 429", async () => {
    // Create dedicated app/server to test IP rate limiting with a clean limiter instance
    const ipApp = express();
    ipApp.use(express.json());
    ipApp.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    ipApp.use("/api", apiRouter);

    const ipServer = http.createServer(ipApp);
    await new Promise<void>((resolve) => ipServer.listen(0, "127.0.0.1", () => resolve()));
    const ipAddr = ipServer.address() as any;
    const ipBaseUrl = `http://127.0.0.1:${ipAddr.port}`;

    try {
      // Send 50 login requests from this IP with a unique identifier so account lockout is not triggered
      for (let i = 1; i <= 50; i++) {
        const res = await fetch(`${ipBaseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `ip_test_${i}_${Date.now()}@test.local`,
            password: "SomePassword123!",
          }),
        });
        expect(res.status).toBe(401);
      }

      // 51st request from same IP
      const res51 = await fetch(`${ipBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `ip_test_51_${Date.now()}@test.local`,
          password: "SomePassword123!",
        }),
      });

      expect(res51.status).toBe(429);
      expect(res51.headers.get("retry-after")).toBeDefined();
      const body = await res51.json();
      expect(body).toEqual({ error: "Too many requests. Please try again later." });
    } finally {
      await new Promise<void>((resolve) => ipServer.close(() => resolve()));
    }
  });

  it("Reset-password requests do not consume the login quota", async () => {
    const quotaApp = express();
    quotaApp.use(express.json());
    quotaApp.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    quotaApp.use("/api/auth/reset-password", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }));
    quotaApp.use("/api", apiRouter);

    const quotaServer = http.createServer(quotaApp);
    await new Promise<void>((resolve) => quotaServer.listen(0, "127.0.0.1", () => resolve()));
    const quotaAddr = quotaServer.address() as any;
    const quotaBaseUrl = `http://127.0.0.1:${quotaAddr.port}`;

    try {
      // Exhaust the reset-password quota (10 requests)
      for (let i = 1; i <= 10; i++) {
        const res = await fetch(`${quotaBaseUrl}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "invalid-token",
            password: "SomeNewPassword123!",
          }),
        });
        expect([400, 429]).toContain(res.status);
      }

      // 11th reset-password request is rate limited (429)
      const res11 = await fetch(`${quotaBaseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "invalid-token",
          password: "SomeNewPassword123!",
        }),
      });
      expect(res11.status).toBe(429);

      // Verify login quota is unaffected and can process requests
      const loginRes = await fetch(`${quotaBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: existingEmail,
          password: existingPassword,
        }),
      });
      expect(loginRes.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => quotaServer.close(() => resolve()));
    }
  });

  it("10 failed logins for one identifier from an IP lock only that IP, preventing third-party DoS on other IPs", async () => {
    // To simulate different IPs, we set trust proxy so req.ip is taken from X-Forwarded-For
    const multiIpApp = express();
    multiIpApp.set("trust proxy", true);
    multiIpApp.use(express.json());
    multiIpApp.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    multiIpApp.use("/api", apiRouter);

    const multiIpServer = http.createServer(multiIpApp);
    await new Promise<void>((resolve) => multiIpServer.listen(0, "127.0.0.1", () => resolve()));
    const multiIpAddr = multiIpServer.address() as any;
    const multiIpBaseUrl = `http://127.0.0.1:${multiIpAddr.port}`;

    const targetAccount = `locked_target_${Date.now()}@test.local`;
    const attackerIp = "192.168.1.100";
    const legitimateUserIp = "10.0.0.99";

    try {
      // 10 failed logins from attacker IP for targetAccount
      for (let i = 1; i <= 10; i++) {
        const res = await fetch(`${multiIpBaseUrl}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": attackerIp,
          },
          body: JSON.stringify({
            email: targetAccount,
            password: "WrongPassword123!",
          }),
        });
        expect(res.status).toBe(401);
      }

      // 11th attempt from attacker IP for that account is locked (429)
      const lockedRes = await fetch(`${multiIpBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": attackerIp,
        },
        body: JSON.stringify({
          email: targetAccount,
          password: "WrongPassword123!",
        }),
      });

      expect(lockedRes.status).toBe(429);
      expect(lockedRes.headers.get("retry-after")).toBeDefined();
      const body = await lockedRes.json();
      expect(body).toEqual({ error: "Too many requests. Please try again later." });

      // Legitimate user from a different IP is NOT locked out (no DoS!)
      const legitimateRes = await fetch(`${multiIpBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": legitimateUserIp,
        },
        body: JSON.stringify({
          email: targetAccount,
          password: "WrongPassword123!",
        }),
      });
      // Returns 401 (invalid credentials) rather than 429 lockout!
      expect(legitimateRes.status).toBe(401);
    } finally {
      await new Promise<void>((resolve) => multiIpServer.close(() => resolve()));
    }
  });

  it("A successful login resets that identifier's failure count", async () => {
    const successUserEmail = `reset_count_user_${Date.now()}@test.local`;
    const pwdHash = await hashPassword(existingPassword);
    const [inserted] = await db!.insert(users).values({
      openId: `reset_user_${Date.now()}`,
      email: successUserEmail,
      name: "Reset Count User",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const createdUserId = Number(inserted.insertId);

    try {
      // Fail 9 times (just below lockout threshold of 10)
      for (let i = 1; i <= 9; i++) {
        const failRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: successUserEmail,
            password: "WrongPassword123!",
          }),
        });
        expect(failRes.status).toBe(401);
      }

      // Successful login resets the failure count
      const okRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: successUserEmail,
          password: existingPassword,
        }),
      });
      expect(okRes.status).toBe(200);

      // Now 9 more failures should NOT lock the account yet (threshold is 10)
      for (let i = 1; i <= 9; i++) {
        const failRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: successUserEmail,
            password: "WrongPassword123!",
          }),
        });
        expect(failRes.status).toBe(401);
      }
    } finally {
      await db!.delete(users).where(eq(users.id, createdUserId));
    }
  });

  it("Identifier matching is case-insensitive and trims whitespace", async () => {
    const caseUser = `case_trim_${Date.now()}@test.local`;

    // Fail 9 times with whitespace and varying uppercase/lowercase
    for (let i = 1; i <= 9; i++) {
      const formatted = i % 2 === 0 ? `  ${caseUser.toUpperCase()}  ` : ` \t${caseUser} \n `;
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formatted,
          password: "WrongPassword123!",
        }),
      });
      expect(res.status).toBe(401);
    }

    // 10th failure using standard lowercase
    const tenthRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: caseUser,
        password: "WrongPassword123!",
      }),
    });
    expect(tenthRes.status).toBe(401);

    // 11th attempt with spaces and uppercase should be locked (429)
    const lockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `   ${caseUser.toUpperCase()}   `,
        password: "WrongPassword123!",
      }),
    });
    expect(lockedRes.status).toBe(429);
    expect(lockedRes.headers.get("retry-after")).toBeDefined();
    const body = await lockedRes.json();
    expect(body).toEqual({ error: "Too many requests. Please try again later." });
  });

  it("Unknown-user and wrong-password failures produce identical responses", async () => {
    // 1. Existing user with wrong password
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: existingEmail,
        password: "WrongPassword999!",
      }),
    });
    const wrongPassBody = await wrongPassRes.json();

    // 2. Unknown non-existent user
    const unknownUserRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `non_existent_${Date.now()}@test.local`,
        password: "WrongPassword999!",
      }),
    });
    const unknownUserBody = await unknownUserRes.json();

    expect(wrongPassRes.status).toBe(401);
    expect(unknownUserRes.status).toBe(401);
    expect(wrongPassBody).toEqual(unknownUserBody);
    expect(wrongPassBody).toEqual({ error: "Invalid username or password" });
  });

  it("Standard RateLimit-* response headers are included on all responses", async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(
      "/api/test-headers",
      createRateLimiter({ windowMs: 60 * 1000, max: 20 })
    );
    testApp.get("/api/test-headers", (_req, res) => res.json({ ok: true }));

    const testServer = http.createServer(testApp);
    await new Promise<void>((resolve) => testServer.listen(0, "127.0.0.1", () => resolve()));
    const addr = testServer.address() as any;
    const testUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const res = await fetch(`${testUrl}/api/test-headers`);
      expect(res.status).toBe(200);
      expect(res.headers.get("ratelimit-limit")).toBe("20");
      expect(res.headers.get("ratelimit-remaining")).toBe("19");
      expect(Number(res.headers.get("ratelimit-reset"))).toBeGreaterThan(0);
      expect(res.headers.get("ratelimit-policy")).toBe("20;w=60");
    } finally {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  it("DISABLE_RATE_LIMIT=1 cannot bypass rate limiting in production mode", () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origDisable = process.env.DISABLE_RATE_LIMIT;

    try {
      process.env.NODE_ENV = "production";
      process.env.DISABLE_RATE_LIMIT = "1";
      // In production, isRateLimitDisabled must ALWAYS return false
      expect(isRateLimitDisabled()).toBe(false);

      process.env.NODE_ENV = "development";
      process.env.DISABLE_RATE_LIMIT = "1";
      expect(isRateLimitDisabled()).toBe(true);
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.DISABLE_RATE_LIMIT = origDisable;
    }
  });

  it("Heavy operations limiter blocks excessive requests with 429 and Retry-After", async () => {
    const heavyApp = express();
    heavyApp.use(express.json());
    heavyApp.use(
      "/api/heavy-task",
      createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: "Too many heavy operations.",
      })
    );
    heavyApp.post("/api/heavy-task", (_req, res) => res.json({ processed: true }));

    const heavyServer = http.createServer(heavyApp);
    await new Promise<void>((resolve) => heavyServer.listen(0, "127.0.0.1", () => resolve()));
    const addr = heavyServer.address() as any;
    const heavyUrl = `http://127.0.0.1:${addr.port}`;

    try {
      for (let i = 1; i <= 3; i++) {
        const res = await fetch(`${heavyUrl}/api/heavy-task`, { method: "POST" });
        expect(res.status).toBe(200);
      }
      const overLimitRes = await fetch(`${heavyUrl}/api/heavy-task`, { method: "POST" });
      expect(overLimitRes.status).toBe(429);
      expect(overLimitRes.headers.get("retry-after")).toBeDefined();
      expect(overLimitRes.headers.get("ratelimit-remaining")).toBe("0");
      const data = await overLimitRes.json();
      expect(data).toEqual({ error: "Too many heavy operations." });
    } finally {
      await new Promise<void>((resolve) => heavyServer.close(() => resolve()));
    }
  });

  it("Browser preflight OPTIONS requests do not consume rate limit quotas", async () => {
    const optApp = express();
    optApp.use(
      "/api/auth/forgot-password",
      createRateLimiter({ windowMs: 60 * 1000, max: 2 })
    );
    optApp.options("/api/auth/forgot-password", (_req, res) => res.sendStatus(204));
    optApp.post("/api/auth/forgot-password", (_req, res) => res.json({ sent: true }));

    const optServer = http.createServer(optApp);
    await new Promise<void>((resolve) => optServer.listen(0, "127.0.0.1", () => resolve()));
    const addr = optServer.address() as any;
    const optUrl = `http://127.0.0.1:${addr.port}`;

    try {
      // Send 5 OPTIONS preflight requests (limit is 2)
      for (let i = 0; i < 5; i++) {
        const preflightRes = await fetch(`${optUrl}/api/auth/forgot-password`, {
          method: "OPTIONS",
        });
        expect(preflightRes.status).toBe(204);
      }

      // Quota is intact: 2 POST requests succeed
      const post1 = await fetch(`${optUrl}/api/auth/forgot-password`, { method: "POST" });
      expect(post1.status).toBe(200);
      const post2 = await fetch(`${optUrl}/api/auth/forgot-password`, { method: "POST" });
      expect(post2.status).toBe(200);

      // 3rd POST request is rate limited
      const post3 = await fetch(`${optUrl}/api/auth/forgot-password`, { method: "POST" });
      expect(post3.status).toBe(429);
    } finally {
      await new Promise<void>((resolve) => optServer.close(() => resolve()));
    }
  });
});

