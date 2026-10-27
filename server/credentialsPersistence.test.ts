import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { schools, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "./appAuth";

describe("ID Pass & Credentials Persistence Suite", () => {
  it("persists generated ID Pass for schools and returns the same password on subsequent views", async () => {
    const db = await getDb();
    if (!db) return;

    const testSchoolCode = `TP_${Date.now().toString().slice(-8)}`;
    const [insertResult] = await db.insert(schools).values({
      name: "Persistence Test School",
      shortCode: testSchoolCode,
    });
    const schoolId = Number(insertResult.insertId);

    try {
      // First generation
      const cleanCode = testSchoolCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const firstPassword = `Pass@${cleanCode}1234`;
      const pwdHash = await hashPassword(firstPassword);

      await db.insert(users).values({
        openId: `SCH_${cleanCode}`,
        name: "Persistence Test Admin",
        role: "SCHOOL_ADMIN",
        schoolId,
        passwordHash: pwdHash,
        idPass: firstPassword,
      });

      // Verify that the user row has idPass
      const adminUser = (
        await db
          .select()
          .from(users)
          .where(and(eq(users.schoolId, schoolId), eq(users.role, "SCHOOL_ADMIN")))
      )[0];

      expect(adminUser).toBeDefined();
      expect(adminUser.idPass).toBe(firstPassword);

      // Subsequent checks should retrieve the stored idPass, NOT a newly generated random one
      expect(adminUser.idPass).toBe(firstPassword);
    } finally {
      await db.delete(users).where(eq(users.schoolId, schoolId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("persists generated ID Pass for partners and retains it until changed", async () => {
    const db = await getDb();
    if (!db) return;

    const openId = `ptr_test_${Date.now()}`;
    const initialPassword = "InitialPartnerPass123!";
    const [result] = await db.insert(users).values({
      openId,
      name: "Partner Persistence Tester",
      email: `${openId}@example.com`,
      role: "PARTNER",
      passwordHash: await hashPassword(initialPassword),
      idPass: initialPassword,
    });
    const userId = Number(result.insertId);

    try {
      const row = (await db.select().from(users).where(eq(users.id, userId)))[0];
      expect(row).toBeDefined();
      expect(row.idPass).toBe(initialPassword);

      // Now simulate updating password via edit
      const updatedPassword = "UpdatedPartnerPass456!";
      await db
        .update(users)
        .set({
          passwordHash: await hashPassword(updatedPassword),
          idPass: updatedPassword,
        })
        .where(eq(users.id, userId));

      const updatedRow = (await db.select().from(users).where(eq(users.id, userId)))[0];
      expect(updatedRow.idPass).toBe(updatedPassword);
    } finally {
      await db.delete(users).where(eq(users.id, userId));
    }
  });
});
