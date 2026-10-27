import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  MemoryRateLimitStore,
  createRateLimiter,
  checkAccountLockout,
  recordAccountLoginFailure,
  resetAccountLoginFailure,
  resolveClientIp,
  resolveClientKey,
  isRateLimitDisabled,
} from "./rateLimit";
import type { Request, Response, NextFunction } from "express";

describe("server/_core/rateLimit unit test suite", () => {
  describe("MemoryRateLimitStore", () => {
    it("increments and tracks counts correctly within a window", () => {
      const store = new MemoryRateLimitStore(10);
      const entry1 = store.increment("test-key", 60_000);
      expect(entry1.count).toBe(1);
      expect(entry1.resetAt).toBeGreaterThan(Date.now());

      const entry2 = store.increment("test-key", 60_000);
      expect(entry2.count).toBe(2);
      expect(entry2.resetAt).toBe(entry1.resetAt);

      const got = store.get("test-key");
      expect(got).toBeDefined();
      expect(got?.count).toBe(2);
    });

    it("resets count when window expires", () => {
      vi.useFakeTimers();
      try {
        const store = new MemoryRateLimitStore(10);
        store.increment("key", 1_000);
        expect(store.get("key")?.count).toBe(1);

        vi.advanceTimersByTime(1_001);

        // get() returns undefined for expired entry
        expect(store.get("key")).toBeUndefined();

        // increment() starts a fresh window
        const nextEntry = store.increment("key", 1_000);
        expect(nextEntry.count).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("resets key explicitly via reset()", () => {
      const store = new MemoryRateLimitStore(10);
      store.increment("to-delete", 60_000);
      expect(store.get("to-delete")).toBeDefined();

      store.reset("to-delete");
      expect(store.get("to-delete")).toBeUndefined();
    });

    it("cleans up expired entries via cleanup()", () => {
      vi.useFakeTimers();
      try {
        const store = new MemoryRateLimitStore(10);
        store.increment("expired-1", 500);
        store.increment("active-1", 5_000);
        expect(store.size()).toBe(2);

        vi.advanceTimersByTime(600);
        store.cleanup();

        expect(store.size()).toBe(1);
        expect(store.get("expired-1")).toBeUndefined();
        expect(store.get("active-1")).toBeDefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("strictly bounds memory and evicts oldest unexpired entries (FIFO/LRU) when maxEntries is exceeded", () => {
      // Store with max capacity of 3
      const store = new MemoryRateLimitStore(3);

      store.increment("k1", 60_000);
      store.increment("k2", 60_000);
      store.increment("k3", 60_000);
      expect(store.size()).toBe(3);

      // Adding 4th entry while none are expired must evict oldest ("k1")
      store.increment("k4", 60_000);
      expect(store.size()).toBe(3);
      expect(store.get("k1")).toBeUndefined();
      expect(store.get("k2")).toBeDefined();
      expect(store.get("k3")).toBeDefined();
      expect(store.get("k4")).toBeDefined();

      // Accessing / incrementing k2 moves it to the most recently used position
      store.increment("k2", 60_000);

      // Adding 5th entry must now evict "k3" instead of "k2"
      store.increment("k5", 60_000);
      expect(store.size()).toBe(3);
      expect(store.get("k3")).toBeUndefined();
      expect(store.get("k2")).toBeDefined();
      expect(store.get("k4")).toBeDefined();
      expect(store.get("k5")).toBeDefined();
    });
  });

  describe("createRateLimiter middleware", () => {
    let origDisable: string | undefined;

    beforeEach(() => {
      origDisable = process.env.DISABLE_RATE_LIMIT;
      process.env.DISABLE_RATE_LIMIT = "0";
    });

    afterEach(() => {
      process.env.DISABLE_RATE_LIMIT = origDisable;
    });

    function mockExpress(method = "GET", ip = "192.168.1.1", headers: Record<string, string> = {}) {
      const req = {
        method,
        ip,
        headers,
        socket: { remoteAddress: ip },
      } as unknown as Request;

      const sentHeaders = new Map<string, any>();
      let statusCode = 200;
      let jsonBody: any = null;

      const res = {
        headersSent: false,
        setHeader: vi.fn((key: string, value: any) => {
          sentHeaders.set(key.toLowerCase(), value);
        }),
        status: vi.fn((code: number) => {
          statusCode = code;
          return res;
        }),
        json: vi.fn((body: any) => {
          jsonBody = body;
          res.headersSent = true;
          return res;
        }),
      } as unknown as Response & {
        sentHeaders: Map<string, any>;
        statusCode: () => number;
        jsonBody: () => any;
      };

      res.statusCode = () => statusCode;
      res.jsonBody = () => jsonBody;

      const next = vi.fn() as unknown as NextFunction;

      return { req, res, next, sentHeaders };
    }

    it("passes requests within limit and sets RateLimit headers", async () => {
      const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
      const { req, res, next, sentHeaders } = mockExpress("GET", "10.0.0.1");

      await limiter(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(sentHeaders.get("ratelimit-limit")).toBe(5);
      expect(sentHeaders.get("ratelimit-remaining")).toBe(4);
      expect(sentHeaders.get("ratelimit-reset")).toBeGreaterThan(0);
      expect(sentHeaders.get("ratelimit-policy")).toBe("5;w=60");
    });

    it("returns HTTP 429 and Retry-After when limit is exceeded", async () => {
      const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
      const ip = "10.0.0.2";

      // 1st request -> ok
      const first = mockExpress("GET", ip);
      await limiter(first.req, first.res, first.next);
      expect(first.next).toHaveBeenCalledTimes(1);

      // 2nd request -> ok
      const second = mockExpress("GET", ip);
      await limiter(second.req, second.res, second.next);
      expect(second.next).toHaveBeenCalledTimes(1);

      // 3rd request -> 429
      const third = mockExpress("GET", ip);
      await limiter(third.req, third.res, third.next);
      expect(third.next).not.toHaveBeenCalled();
      expect(third.res.statusCode()).toBe(429);
      expect(third.sentHeaders.get("retry-after")).toBeGreaterThan(0);
      expect(third.res.jsonBody()).toEqual({
        error: "Too many requests. Please try again later.",
      });
    });

    it("skips preflight OPTIONS requests without consuming quota", async () => {
      const store = new MemoryRateLimitStore(10);
      const limiter = createRateLimiter({ windowMs: 60_000, max: 1, store });
      const ip = "10.0.0.3";

      // Send 5 OPTIONS requests
      for (let i = 0; i < 5; i++) {
        const { req, res, next } = mockExpress("OPTIONS", ip);
        await limiter(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      }

      // Store size should still be 0 (no quota consumed)
      expect(store.size()).toBe(0);

      // 1st POST succeeds
      const post1 = mockExpress("POST", ip);
      await limiter(post1.req, post1.res, post1.next);
      expect(post1.next).toHaveBeenCalledTimes(1);

      // 2nd POST is blocked
      const post2 = mockExpress("POST", ip);
      await limiter(post2.req, post2.res, post2.next);
      expect(post2.res.statusCode()).toBe(429);
    });

    it("does not mutate headers if res.headersSent is already true", async () => {
      const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
      const { req, res, next } = mockExpress("GET", "10.0.0.4");
      res.headersSent = true;

      await limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it("bypasses rate limiting in non-production when DISABLE_RATE_LIMIT=1", async () => {
      process.env.DISABLE_RATE_LIMIT = "1";
      process.env.NODE_ENV = "development";

      const store = new MemoryRateLimitStore(10);
      const limiter = createRateLimiter({ windowMs: 60_000, max: 1, store });
      const { req, res, next } = mockExpress("GET", "10.0.0.5");

      await limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(store.size()).toBe(0);
    });
  });

  describe("Account Lockout & Composite IP Keying (DoS Protection)", () => {
    let origDisable: string | undefined;

    beforeEach(() => {
      origDisable = process.env.DISABLE_RATE_LIMIT;
      process.env.DISABLE_RATE_LIMIT = "0";
    });

    afterEach(() => {
      process.env.DISABLE_RATE_LIMIT = origDisable;
    });

    it("locks an identifier only from the attacking IP after 10 failures, leaving legitimate users unblocked", () => {
      const email = `victim_user_${Date.now()}@edunextg.com`;
      const attackerIp = "198.51.100.55";
      const legitimateIp = "203.0.113.10";

      // Initially both are not locked
      expect(checkAccountLockout(email, attackerIp).locked).toBe(false);
      expect(checkAccountLockout(email, legitimateIp).locked).toBe(false);

      // Attacker attempts 9 bad passwords
      for (let i = 0; i < 9; i++) {
        recordAccountLoginFailure(email, attackerIp);
      }
      expect(checkAccountLockout(email, attackerIp).locked).toBe(false);

      // 10th failure from attacker IP locks that IP out for that account
      recordAccountLoginFailure(email, attackerIp);
      const attackerLockout = checkAccountLockout(email, attackerIp);
      expect(attackerLockout.locked).toBe(true);
      expect(attackerLockout.retryAfterSeconds).toBeGreaterThan(0);

      // CRITICAL: Legitimate user from different IP is NOT locked out (no DoS!)
      const legitimateLockout = checkAccountLockout(email, legitimateIp);
      expect(legitimateLockout.locked).toBe(false);
      expect(legitimateLockout.retryAfterSeconds).toBe(0);

      // Other accounts on attacker IP are also not locked
      expect(checkAccountLockout("other_user@edunextg.com", attackerIp).locked).toBe(false);

      // Resetting the failure clears the lockout
      resetAccountLoginFailure(email, attackerIp);
      expect(checkAccountLockout(email, attackerIp).locked).toBe(false);
    });

    it("normalizes identifiers (case and whitespace insensitivity)", () => {
      const email = `case_test_${Date.now()}@edunextg.com`;
      const ip = "192.168.1.50";

      // 10 failures with messy uppercase and surrounding spaces
      for (let i = 0; i < 10; i++) {
        recordAccountLoginFailure(`   ${email.toUpperCase()}   `, ip);
      }

      // Checking with clean lowercase returns locked
      const lockout = checkAccountLockout(email, ip);
      expect(lockout.locked).toBe(true);
      expect(lockout.retryAfterSeconds).toBeGreaterThan(0);

      // Resetting with another whitespace variant unlocks
      resetAccountLoginFailure(` \t${email} \n `, ip);
      expect(checkAccountLockout(email, ip).locked).toBe(false);
    });
  });

  describe("resolveClientIp & resolveClientKey", () => {
    it("prioritizes cf-connecting-ip when deployed behind Cloudflare", () => {
      const req = {
        headers: {
          "cf-connecting-ip": "203.0.113.195",
        },
        ip: "10.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      } as unknown as Request;

      expect(resolveClientIp(req)).toBe("203.0.113.195");
      expect(resolveClientKey(req)).toBe("203.0.113.195");
    });

    it("falls back to req.ip and socket.remoteAddress", () => {
      const reqWithIp = {
        headers: {},
        ip: "192.168.1.42",
        socket: { remoteAddress: "127.0.0.1" },
      } as unknown as Request;
      expect(resolveClientIp(reqWithIp)).toBe("192.168.1.42");

      const reqWithSocket = {
        headers: {},
        ip: undefined,
        socket: { remoteAddress: "172.16.0.5" },
      } as unknown as Request;
      expect(resolveClientIp(reqWithSocket)).toBe("172.16.0.5");
    });

    it("prioritizes authenticated user ID over IP address", () => {
      const req = {
        headers: {},
        ip: "192.168.1.42",
        user: { id: 123 },
      } as unknown as Request;

      expect(resolveClientKey(req)).toBe("user:123");
    });
  });
});

