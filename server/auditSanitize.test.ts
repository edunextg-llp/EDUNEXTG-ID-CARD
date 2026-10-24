import { describe, it, expect } from "vitest";
import { sanitizeForAudit } from "./auditSanitize";

describe("sanitizeForAudit Unit Suite", () => {
  it("deep-clones objects without mutating the original input", () => {
    const original = { name: "Test School", config: { theme: "dark" } };
    const sanitized = sanitizeForAudit(original);

    expect(sanitized).toEqual(original);
    expect(sanitized).not.toBe(original);
    expect(sanitized.config).not.toBe(original.config);

    sanitized.config.theme = "light";
    expect(original.config.theme).toBe("dark");
  });

  it("redacts keys matching /password|token|secret|hash|authorization/i", () => {
    const input = {
      user: "admin",
      password: "SuperSecretPassword123!",
      userPassword: "AnotherPassword!",
      apiToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      client_secret: "shhh-secret",
      passwordHash: "$scrypt$N=32768,r=8,p=1$...",
      tokenHash: "abc123hash",
      authorization: "Bearer my-auth-token",
      nested: {
        SECRET_KEY: "top-secret",
        normalKey: "safe value",
      },
      array: [
        { refreshToken: "token-in-array", name: "Safe" },
      ],
    };

    const sanitized = sanitizeForAudit(input) as any;

    expect(sanitized.user).toBe("admin");
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.userPassword).toBe("[REDACTED]");
    expect(sanitized.apiToken).toBe("[REDACTED]");
    expect(sanitized.client_secret).toBe("[REDACTED]");
    expect(sanitized.passwordHash).toBe("[REDACTED]");
    expect(sanitized.tokenHash).toBe("[REDACTED]");
    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(sanitized.nested.SECRET_KEY).toBe("[REDACTED]");
    expect(sanitized.nested.normalKey).toBe("safe value");
    expect(sanitized.array[0].refreshToken).toBe("[REDACTED]");
    expect(sanitized.array[0].name).toBe("Safe");
  });

  it("truncates strings over 2000 characters to 2000 characters", () => {
    const longString = "A".repeat(3500);
    const input = { notes: longString, shortNote: "Hello world" };

    const sanitized = sanitizeForAudit(input);

    expect(sanitized.shortNote).toBe("Hello world");
    expect(sanitized.notes.length).toBe(2000);
    expect(sanitized.notes).toBe("A".repeat(2000));
  });

  it("replaces data-URI and base64 payloads with [BINARY OMITTED]", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const rawLongBase64 = "A".repeat(300); // 300 base64 chars

    const input = {
      logo: dataUri,
      photoPayload: rawLongBase64,
      normalCode: "ABC-123",
    };

    const sanitized = sanitizeForAudit(input);

    expect(sanitized.logo).toBe("[BINARY OMITTED]");
    expect(sanitized.photoPayload).toBe("[BINARY OMITTED]");
    expect(sanitized.normalCode).toBe("ABC-123");
  });

  it("handles null, undefined, primitive values, and dates safely", () => {
    expect(sanitizeForAudit(null)).toBeNull();
    expect(sanitizeForAudit(undefined)).toBeUndefined();
    expect(sanitizeForAudit(12345)).toBe(12345);
    expect(sanitizeForAudit(true)).toBe(true);

    const now = new Date();
    const sanitizedDate = sanitizeForAudit(now);
    expect(sanitizedDate).toEqual(now);
    expect(sanitizedDate).not.toBe(now);
  });

  it("handles circular references gracefully without throwing stack overflow", () => {
    const circular: any = { name: "Root" };
    circular.self = circular;

    const sanitized = sanitizeForAudit(circular);
    expect(sanitized.name).toBe("Root");
    expect(sanitized.self).toBe("[CIRCULAR]");
  });
});
