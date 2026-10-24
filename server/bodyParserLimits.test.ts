import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { schools, users, idCardTemplates, idCards } from "../drizzle/schema";
import { createRateLimiter } from "./_core/rateLimit";
import { configureBodyParsers } from "./_core/bodyParserConfig";

describe("Request Body Size Limits & DoS Hardening Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;

  let adminToken: string;
  let adminUserId: number;
  let testSchoolId: number;
  let testCardId: number;
  let testTemplateId: number;

  beforeAll(async () => {
    const maybeDb = await getDb();
    if (!maybeDb) throw new Error("Database connection required");
    db = maybeDb;

    // Build express application replicating the middleware chain in server/_core/index.ts
    const app = express();

    // 1. Auth rate limiters BEFORE body parsers
    app.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    app.use("/api/auth/forgot-password", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }));
    app.use("/api/auth/reset-password", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }));

    // 2. Body parsers (route-specific 50mb limit, then global 100kb limit)
    configureBodyParsers(app);

    // 3. API router
    app.use("/api", apiRouter);

    // 4. 413 error handler
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const bodyParserError = error as { type?: string; status?: number };
      if (bodyParserError.type === "entity.too.large" || bodyParserError.status === 413) {
        return res.status(413).json({ error: "Request body is too large" });
      }
      return res.status(500).json({ error: "An internal error occurred" });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Server failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const ts = Date.now();
    const testPassword = "AdminPass123!@#";
    const pwdHash = await hashPassword(testPassword);

    const adminEmail = `bodylimit_admin_${ts}@test.local`;
    const [adminRes] = await db.insert(users).values({
      openId: `bodylimit_admin_${ts}`,
      email: adminEmail,
      name: "Body Limit Admin",
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

    // Create a school for tests
    const schoolCode = `BL${Math.floor(1000 + Math.random() * 9000)}`;
    const [schoolRes] = await db.insert(schools).values({
      name: `Body Limit School ${schoolCode}`,
      shortCode: schoolCode,
      email: `contact@${schoolCode.toLowerCase()}.test`,
      isActive: true,
      createdByUserId: adminUserId,
    });
    testSchoolId = Number(schoolRes.insertId);

    // Create an active template
    const [tmplRes] = await db.insert(idCardTemplates).values({
      name: `Body Limit Template ${ts}`,
      status: "ACTIVE",
      orientation: "portrait",
      cardWidth: 204,
      cardHeight: 324,
      createdByUserId: adminUserId,
    });
    testTemplateId = Number(tmplRes.insertId);

    // Create an ID card
    const [cardRes] = await db.insert(idCards).values({
      schoolId: testSchoolId,
      templateId: testTemplateId,
      cardNumber: `CARD-${ts}`,
      status: "DRAFT",
      submittedByUserId: adminUserId,
    });
    testCardId = Number(cardRes.insertId);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("1. 1 MB payload to /api/auth/login returns 413 Request body is too large", async () => {
    // 1 MB payload
    const largePadding = "a".repeat(1024 * 1024);
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin@example.com",
        password: "ValidPassword123!",
        extra: largePadding,
      }),
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("Request body is too large");
  });

  it("2. Large body (> 100kb) to non-upload route (/api/schools) returns 413", async () => {
    // 200 KB payload
    const largePadding = "x".repeat(200 * 1024);
    const res = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test School",
        shortCode: "TST",
        padding: largePadding,
      }),
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("Request body is too large");
  });

  it("3. Large body (> 100kb) to /api/auth/forgot-password returns 413", async () => {
    const largePadding = "x".repeat(150 * 1024);
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        padding: largePadding,
      }),
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("Request body is too large");
  });

  it("4. Normal upload (> 100kb payload) works on POST /api/upload", async () => {
    // Generate valid JPEG image header + ~200 KB data
    const jpegBuffer = Buffer.alloc(200 * 1024);
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01]).copy(jpegBuffer, 0);

    const res = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: "large_student_photo.jpg",
        contentType: "image/jpeg",
        dataBase64: jpegBuffer.toString("base64"),
        schoolId: testSchoolId,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
  });

  it("5. Normal upload (> 100kb payload) works on POST /api/profile/picture", async () => {
    // ~150 KB avatar data
    const avatarDataUri = `data:image/png;base64,${"A".repeat(150 * 1024)}`;

    const res = await fetch(`${baseUrl}/api/profile/picture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        avatarUrl: avatarDataUri,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.avatarUrl).toBe(avatarDataUri);
  });

  it("6. Normal upload (> 100kb payload) works on POST /api/id-cards/:id/files", async () => {
    // ~150 KB file metadata
    const largeFileUrl = `https://storage.example.com/files/${"x".repeat(150 * 1024)}`;

    const res = await fetch(`${baseUrl}/api/id-cards/${testCardId}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileType: "DOCUMENT",
        fileName: "admission_form.pdf",
        fileUrl: largeFileUrl,
        fileSize: 150 * 1024,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.fileType).toBe("DOCUMENT");
  });

  it("7. Normal upload (> 100kb payload) works on PUT /api/templates/:id with designer elements", async () => {
    // Generate 15 template elements each with ~8KB config (total > 120 KB)
    const elements = Array.from({ length: 15 }, (_, i) => ({
      elementKey: `element_${i}_${Date.now()}`,
      elementType: "SHAPE",
      label: `Shape Element ${i}`,
      config: {
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        svgPath: "M0 0 L100 0 L100 100 L0 100 Z ".repeat(300),
      },
      sortOrder: i,
    }));

    const payload = JSON.stringify({
      name: "Updated Large Template with Elements",
      elements,
    });
    expect(payload.length).toBeGreaterThan(100 * 1024);

    const res = await fetch(`${baseUrl}/api/templates/${testTemplateId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("8. Normal upload (> 100kb payload) reaches POST /api/id-card-requests/upload-excel", async () => {
    // 120 KB Excel base64 payload
    const dummyExcelBase64 = Buffer.alloc(120 * 1024, 0x50).toString("base64");

    const res = await fetch(`${baseUrl}/api/id-card-requests/upload-excel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: testSchoolId,
        templateId: testTemplateId,
        filename: "students.xlsx",
        fileBase64: dummyExcelBase64,
      }),
    });

    // The route parser accepts the >100kb payload (does NOT return 413)
    // The route handler executes and returns domain error (e.g. invalid zip/excel header) not 413
    expect(res.status).not.toBe(413);
  });

  it("9. Normal upload (> 100kb payload) works on POST /api/id-cards", async () => {
    // 120 KB data map or fields
    const res = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: testSchoolId,
        templateId: testTemplateId,
        data: {
          studentName: "John Doe",
          address: "123 School Lane",
          customNotes: "Z".repeat(120 * 1024),
        },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
  });
});
