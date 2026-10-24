const SECRET_KEY_PATTERN = /password|token|secret|hash|authorization/i;
const MAX_STRING_LENGTH = 2000;

function isBinaryOrDataUri(val: string, key?: string): boolean {
  if (val.startsWith("data:")) return true;
  if (key && /base64|photo|image|avatar|file|attachment|payload/i.test(key) && val.length > 50) return true;
  // Magic headers in base64: PNG (iVBORw0KGgo), JPEG (/9j/), WebP (UklGR), PDF (JVBER), ZIP (UEsDB), GIF (R0lGO)
  if (/^(?:iVBORw0KGgo|\/9j\/|UklGR|JVBER|UEsDB|R0lGO)/.test(val)) return true;
  // Generic base64 without whitespace that has base64 symbols (+, /, or padding =)
  if (val.length > 100 && !/\s/.test(val) && (val.includes("/") || val.includes("+") || val.endsWith("=")) && /^[A-Za-z0-9+/=]+$/.test(val)) {
    return true;
  }
  return false;
}

/**
 * Sanitizes an object before persisting into audit logs:
 * - Deep clones the object/array
 * - Replaces values of keys matching /password|token|secret|hash|authorization/i with "[REDACTED]"
 * - Truncates strings over 2000 characters
 * - Replaces base64 and data-URI values with "[BINARY OMITTED]"
 */
export function sanitizeForAudit<T>(obj: T, seen = new WeakSet()): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    if (isBinaryOrDataUri(obj)) {
      return "[BINARY OMITTED]" as unknown as T;
    }
    if (obj.length > MAX_STRING_LENGTH) {
      return obj.slice(0, MAX_STRING_LENGTH) as unknown as T;
    }
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (seen.has(obj)) {
    return "[CIRCULAR]" as unknown as T;
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForAudit(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      if (isBinaryOrDataUri(value, key)) {
        result[key] = "[BINARY OMITTED]";
      } else if (value.length > MAX_STRING_LENGTH) {
        result[key] = value.slice(0, MAX_STRING_LENGTH);
      } else {
        result[key] = value;
      }
    } else if (value !== null && typeof value === "object") {
      result[key] = sanitizeForAudit(value, seen);
    } else {
      result[key] = value;
    }
  }

  return result as unknown as T;
}
