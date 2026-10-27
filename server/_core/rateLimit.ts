import type { NextFunction, Request, Response } from "express";

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Storage contract for rate limiting entries.
 * Allows seamless drop-in of external distributed stores (e.g. Redis, Memcached, MySQL)
 * when horizontally scaling across multiple server instances.
 */
export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitEntry> | RateLimitEntry;
  get?(key: string): Promise<RateLimitEntry | undefined> | RateLimitEntry | undefined;
  reset?(key: string): Promise<void> | void;
  size?(): number;
}

/**
 * Bounded in-memory store with automatic expired entry pruning.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private entries = new Map<string, RateLimitEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const current = this.entries.get(key);
    const entry =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;
    entry.count += 1;
    // Move updated entry to the end to maintain LRU/FIFO ordering
    this.entries.delete(key);
    this.entries.set(key, entry);

    if (this.entries.size > this.maxEntries) {
      this.cleanup(now);
      while (this.entries.size > this.maxEntries) {
        const oldestKey = this.entries.keys().next().value;
        if (!oldestKey) break;
        this.entries.delete(oldestKey);
      }
    }

    return entry;
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.resetAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  size(): number {
    return this.entries.size;
  }

  cleanup(now = Date.now()): void {
    this.entries.forEach((value, entryKey) => {
      if (value.resetAt <= now) this.entries.delete(entryKey);
    });
  }
}

/**
 * Returns true if rate limiting should be bypassed.
 * Rate limiting CANNOT be bypassed in production under any circumstance.
 */
export function isRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.DISABLE_RATE_LIMIT === "1";
}

/**
 * Resolves the client IP address.
 * Relies on Express's built-in req.ip backed by app.set("trust proxy", ...),
 * falling back to socket remote address or "unknown".
 */
export function resolveClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Resolves a reliable client key for rate limiting.
 * Prioritizes authenticated user ID when available to prevent shared NAT/proxy collisions
 * and protect against X-Forwarded-For IP spoofing on authenticated endpoints.
 */
export function resolveClientKey(req: Request, res?: Response): string {
  const user = (res?.locals?.user as { id?: number | string } | undefined) ?? (req as any).user;
  if (user?.id) {
    return `user:${user.id}`;
  }
  return resolveClientIp(req);
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request, res?: Response) => string;
  message?: string;
  store?: RateLimitStore;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = options.store || new MemoryRateLimitStore();

  return async (req: Request, res: Response, next: NextFunction) => {
    // Ignore CORS preflight OPTIONS requests so they do not consume rate limit quotas
    if (req.method === "OPTIONS") return next();

    if (isRateLimitDisabled()) return next();

    const now = Date.now();
    const key = options.keyGenerator
      ? options.keyGenerator(req, res)
      : resolveClientKey(req, res);

    const entry = await store.increment(key, options.windowMs);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    const remaining = Math.max(0, options.max - entry.count);

    // Standard IETF RateLimit & RFC 6585 response headers (guarded against early sent headers)
    if (!res.headersSent) {
      res.setHeader("RateLimit-Limit", options.max);
      res.setHeader("RateLimit-Remaining", remaining);
      res.setHeader("RateLimit-Reset", retryAfterSeconds);
      res.setHeader("RateLimit-Policy", `${options.max};w=${Math.round(options.windowMs / 1000)}`);
    }

    if (entry.count > options.max) {
      if (!res.headersSent) {
        res.setHeader("Retry-After", retryAfterSeconds);
      }
      return res.status(429).json({
        error: options.message || "Too many requests. Please try again later.",
      });
    }

    next();
  };
}

// In-memory per-account failed login tracker.
const accountFailureStore = new MemoryRateLimitStore(5_000);
const ACCOUNT_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_FAILURE_MAX = 10;

function normalizeAccountKey(identifier: string): string {
  return identifier.trim().toLowerCase();
}

/**
 * Composite key helper binding client IP and normalized account identifier.
 * Prevents third-party unauthenticated attackers from causing Denial of Service
 * against legitimate users and administrators by spraying failed logins.
 */
function buildAccountFailureKey(identifier: string, ip = "unknown"): string {
  return `${ip}:${normalizeAccountKey(identifier)}`;
}

export function checkAccountLockout(
  identifier: string,
  ip = "unknown"
): { locked: boolean; retryAfterSeconds: number } {
  if (isRateLimitDisabled()) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  const normalized = normalizeAccountKey(identifier);
  if (!normalized) return { locked: false, retryAfterSeconds: 0 };

  const key = buildAccountFailureKey(normalized, ip);
  const entry = accountFailureStore.get(key);
  if (!entry) return { locked: false, retryAfterSeconds: 0 };

  if (entry.count >= ACCOUNT_FAILURE_MAX) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
    return { locked: true, retryAfterSeconds };
  }

  return { locked: false, retryAfterSeconds: 0 };
}

export function recordAccountLoginFailure(identifier: string, ip = "unknown"): void {
  if (isRateLimitDisabled()) return;

  const normalized = normalizeAccountKey(identifier);
  if (!normalized) return;

  const key = buildAccountFailureKey(normalized, ip);
  accountFailureStore.increment(key, ACCOUNT_FAILURE_WINDOW_MS);
}

export function resetAccountLoginFailure(identifier: string, ip = "unknown"): void {
  const normalized = normalizeAccountKey(identifier);
  if (!normalized) return;

  const key = buildAccountFailureKey(normalized, ip);
  accountFailureStore.reset(key);
}

/**
 * Strict rate limiter for CPU/memory-heavy operations:
 * PDF generation, bulk approvals, bulk print, and reporting.
 * 60 requests / 1 minute per user/IP.
 */
export const heavyOperationsLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many heavy processing requests. Please wait a moment before trying again.",
});

/**
 * Rate limiter for file, picture, and bulk photo uploads.
 * 60 upload requests / 1 minute per user/IP.
 */
export const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Upload rate limit exceeded. Please wait a moment before uploading again.",
});

/**
 * General authenticated API safety limit.
 * 1000 requests / 15 minutes per user/IP.
 */
export const authenticatedApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many API requests. Please slow down.",
});
