import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { schools, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("Partner School Modification & Account Takeover Protection", () => {
  let server: http.Server;
  let baseUrl: string;
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;

  let superAdminToken: string;
  let partnerAToken: string;
  let partnerBToken: string;

  let partnerAUserId: number;
  let partnerBUserId: number;

  let schoolAId: number;
  let schoolBId: number;
  let legacySchoolId: number;

  beforeAll(async () => {
    const maybeDb = await getDb();
    if (!maybeDb) throw new Error("Database connection required");
    db = maybeDb;

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Server failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const ts = Date.now();
    const testPassword = "SecPartnerPassword123!";
    const pwdHash = await hashPassword(testPassword);

    // 1. Create Super Admin
    const adminEmail = `superadmin_${ts}@test.local`;
    await db.insert(users).values({
      openId: `superadmin_${ts}`,
      email: adminEmail,
      name: "Super Admin User",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const adminLogin = await loginUser(adminEmail, testPassword);
    if (!adminLogin) throw new Error("Failed to log in as Super Admin");
    superAdminToken = adminLogin.token;

    // 2. Create Partner A
    const partnerAEmail = `partner_a_${ts}@test.local`;
    const [pARes] = await db.insert(users).values({
      openId: `partner_a_${ts}`,
      email: partnerAEmail,
      name: "Partner A User",
      role: "PARTNER",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    partnerAUserId = Number(pARes.insertId);
    const pALogin = await loginUser(partnerAEmail, testPassword);
    if (!pALogin) throw new Error("Failed to log in as Partner A");
    partnerAToken = pALogin.token;

    // 3. Create Partner B
    const partnerBEmail = `partner_b_${ts}@test.local`;
    const [pBRes] = await db.insert(users).values({
      openId: `partner_b_${ts}`,
      email: partnerBEmail,
      name: "Partner B User",
      role: "PARTNER",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    partnerBUserId = Number(pBRes.insertId);
    const pBLogin = await loginUser(partnerBEmail, testPassword);
    if (!pBLogin) throw new Error("Failed to log in as Partner B");
    partnerBToken = pBLogin.token;

    // 4. Create Legacy School with createdByUserId = NULL
    const legacyCode = `LEG${Math.floor(1000 + Math.random() * 9000)}`;
    const [legRes] = await db.insert(schools).values({
      name: "Legacy System School",
      shortCode: legacyCode,
      email: `legacy@${legacyCode.toLowerCase()}.test`,
      isActive: true,
      createdByUserId: null,
    });
    legacySchoolId = Number(legRes.insertId);

    // 5. Partner A creates School A via POST /api/schools
    const codeA = `PA${Math.floor(1000 + Math.random() * 9000)}`;
    const postResA = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${partnerAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Partner A School ${codeA}`,
        shortCode: codeA,
        email: `contact@${codeA.toLowerCase()}.test`,
        phone: "9876543210",
        address: "Address A",
      }),
    });
    expect(postResA.status).toBe(201);
    const schoolAData = await postResA.json();
    schoolAId = schoolAData.id;

    // Verify createdByUserId was set to Partner A's user id
    const [schoolARow] = await db.select().from(schools).where(eq(schools.id, schoolAId));
    expect(schoolARow.createdByUserId).toBe(partnerAUserId);

    // 6. Partner B creates School B via POST /api/schools
    const codeB = `PB${Math.floor(1000 + Math.random() * 9000)}`;
    const postResB = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${partnerBToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Partner B School ${codeB}`,
        shortCode: codeB,
        email: `contact@${codeB.toLowerCase()}.test`,
        phone: "9876543211",
        address: "Address B",
      }),
    });
    expect(postResB.status).toBe(201);
    const schoolBData = await postResB.json();
    schoolBId = schoolBData.id;

    const [schoolBRow] = await db.select().from(schools).where(eq(schools.id, schoolBId));
    expect(schoolBRow.createdByUserId).toBe(partnerBUserId);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("1. Partner A can edit non-email fields of their own school (PUT/PATCH /schools/:id)", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolAId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${partnerAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Partner A School Updated Name",
        address: "Updated Address 123",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Partner A School Updated Name");
    expect(data.address).toBe("Updated Address 123");

    const [row] = await db.select().from(schools).where(eq(schools.id, schoolAId));
    expect(row.name).toBe("Partner A School Updated Name");
    expect(row.address).toBe("Updated Address 123");
  });

  it("2. Partner A editing Partner B's school gets 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolBId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${partnerAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Hijacked School B Name",
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/You can only edit schools created by your account/i);

    // Verify School B name was not modified
    const [row] = await db.select().from(schools).where(eq(schools.id, schoolBId));
    expect(row.name).not.toBe("Hijacked School B Name");
  });

  it("3. Partner A editing a legacy school (createdByUserId: null) gets 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${legacySchoolId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${partnerAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Hijacked Legacy School",
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/You can only edit schools created by your account/i);
  });

  it("4. Partner cannot change the school email on their own school (returns 403 Forbidden)", async () => {
    const [beforeSchool] = await db.select().from(schools).where(eq(schools.id, schoolAId));
    const [beforeAdminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.schoolId, schoolAId), eq(users.role, "SCHOOL_ADMIN")));

    const res = await fetch(`${baseUrl}/api/schools/${schoolAId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${partnerAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "attacker_partner@hijack.test",
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Only Super Admin can change school email/i);

    // Verify school email and school admin user email remain unchanged
    const [afterSchool] = await db.select().from(schools).where(eq(schools.id, schoolAId));
    expect(afterSchool.email).toBe(beforeSchool.email);

    const [afterAdminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.schoolId, schoolAId), eq(users.role, "SCHOOL_ADMIN")));
    expect(afterAdminUser.email).toBe(beforeAdminUser.email);
  });

  it("5. Super Admin can edit any school's non-email fields", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolBId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Super Admin Renamed School B",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Super Admin Renamed School B");
  });

  it("6. Super Admin can change school email and it syncs to SCHOOL_ADMIN user", async () => {
    const newSchoolEmail = `new_verified_email_${Date.now()}@schoola.edu`;

    const res = await fetch(`${baseUrl}/api/schools/${schoolAId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: newSchoolEmail,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe(newSchoolEmail);

    // Verify schools table
    const [schoolRow] = await db.select().from(schools).where(eq(schools.id, schoolAId));
    expect(schoolRow.email).toBe(newSchoolEmail);

    // Verify SCHOOL_ADMIN user email was synced
    const [adminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.schoolId, schoolAId), eq(users.role, "SCHOOL_ADMIN")));
    expect(adminUser.email).toBe(newSchoolEmail);
  });
});
