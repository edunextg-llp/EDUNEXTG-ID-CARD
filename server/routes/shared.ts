import { type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  auditLogs,
  notifications,
  schools,
  type User,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { authenticateApplicationRequest } from "../appAuth";
import { sanitizeForAudit } from "../auditSanitize";

export { sanitizeForAudit };

export const adminRoles = new Set(["SUPER_ADMIN"]);
export const schoolManagerRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
export const schoolWriteRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "SCHOOL_OPERATOR"]);
export const partnerRoles = new Set(["PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"]);
export const schoolCreateRoles = new Set(["SUPER_ADMIN", "PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"]);
export const orderRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"]);
export const profileRoles = new Set(["SUPER_ADMIN", "PARTNER", "PARTNER_ADMIN", "MARKETING_ADMIN"]);

export function currentUser(res: Response): User {
  return res.locals.user as User;
}

export function safeUser(user: User) {
  const { passwordHash: _passwordHash, idPass: _idPass, ...publicUser } = user;
  return publicUser;
}

export function parseJsonColumn(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function normalizeTemplateElement<T extends { config: unknown }>(element: T) {
  return { ...element, config: parseJsonColumn(element.config) };
}

export function canManageSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || (schoolManagerRoles.has(user.role) && user.schoolId === schoolId);
}

export function canWriteSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || (schoolWriteRoles.has(user.role) && user.schoolId === schoolId);
}

export function canReadSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || partnerRoles.has(user.role) || (user.schoolId !== null && user.schoolId === schoolId);
}

export function requestedSchoolId(user: User, value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return adminRoles.has(user.role) || partnerRoles.has(user.role) ? id : user.schoolId === id ? id : null;
}

export async function audit(
  user: User,
  action: string,
  entityType: string,
  entityId: number | null,
  schoolId: number | null,
  newValues?: unknown,
  oldValues?: unknown,
) {
  const db = await getDb();
  if (!db) return;
  try {
    let validSchoolId = schoolId;
    if (validSchoolId) {
      const [exists] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, validSchoolId)).limit(1);
      if (!exists) validSchoolId = null;
    }
    await db.insert(auditLogs).values({
      userId: user.id > 0 ? user.id : null,
      schoolId: validSchoolId,
      action,
      actorRole: user.role,
      entityType,
      entityId,
      oldValues: oldValues !== undefined ? (sanitizeForAudit(oldValues) as never) : undefined,
      newValues: newValues !== undefined ? (sanitizeForAudit(newValues) as never) : undefined,
    });
  } catch (err) {
    console.warn("[Audit] Could not record audit log:", err);
  }
}

export async function notify(userId: number, schoolId: number | null, type: string, title: string, message: string, entityType?: string, entityId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(notifications).values({ userId, schoolId, type, title, message, entityType, entityId });
  } catch (err) {
    console.warn("[Notification] Could not deliver notification:", err);
  }
}

export async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateApplicationRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.locals.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Authentication required" });
  }
}

export function requireRole(roles: Set<string>) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!roles.has(currentUser(res).role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

export function fail(res: Response, error: unknown) {
  console.error("[API]", error);
  // In production, avoid leaking internal error details to the client
  const isProduction = process.env.NODE_ENV === "production";
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Database operation failed";
  const message = isProduction ? "An internal error occurred. Please try again or contact support." : rawMessage;
  return res.status(500).json({ error: message });
}
