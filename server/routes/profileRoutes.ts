import { Router } from "express";
import { and, eq, isNull, ne } from "drizzle-orm";
import { passwordResets, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { isValidIndianMobileNumber, INDIAN_MOBILE_ERROR_MESSAGE } from "../../shared/phoneValidation";
import { uploadLimiter } from "../_core/rateLimit";
import { detectImageMimeType } from "../imageValidation";
import { compressPhotoBuffer } from "../bulkPhotos";
import { hashPassword, setApplicationSession, signApplicationSession, verifyPassword } from "../appAuth";
import { audit, currentUser, profileRoles, requireRole, safeUser } from "./shared";

const router = Router();

// --- About Us ---------------------------------------------------------------
router.get("/about", async (_req, res) => {
  res.json({
    title: "About Insight Education & EduNextG",
    version: "2.4.0",
    description: "Enterprise Multi-Tenant School ID Card Issuance, Dynamic Template Design, & Verification Platform.",
  });
});

// --- Profile Management (Super Admin, Marketing Admin) ---------------------
router.get("/profile", requireRole(profileRoles), async (_req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const freshUser = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    if (!freshUser) return res.status(404).json({ error: "User not found" });
    res.json(safeUser(freshUser));
  } catch (e) {
    console.error("[Profile GET Error]", e);
    res.status(500).json({ error: "Unable to load profile. Please try again." });
  }
});

router.put("/profile", requireRole(profileRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    const email = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : undefined;
    const rawPhone = req.body.phone !== undefined ? (req.body.phone !== null ? String(req.body.phone).trim() : null) : undefined;
    const phone = rawPhone ? rawPhone.replace(/\D/g, "").slice(-10) : (rawPhone === "" ? null : rawPhone);

    if (name !== undefined && !name) {
      return res.status(400).json({ error: "Name cannot be empty." });
    }

    if (rawPhone !== undefined && rawPhone !== null && rawPhone !== "" && !isValidIndianMobileNumber(rawPhone, false)) {
      return res.status(400).json({ error: INDIAN_MOBILE_ERROR_MESSAGE });
    }

    if (email !== undefined) {
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "A valid email address is required." });
      }
      const existing = (
        await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, email), ne(users.id, user.id)))
      )[0];
      if (existing) {
        return res.status(400).json({ error: "Email is already in use by another account." });
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone || null;

    await db.update(users).set(updates).where(eq(users.id, user.id));
    await audit(user, "UPDATE_PROFILE", "user", user.id, null, { name, email, phone });

    const updated = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    res.json({
      success: true,
      message: "Profile updated successfully.",
      user: safeUser(updated),
    });
  } catch (e) {
    console.error("[Profile PUT Error]", e);
    res.status(500).json({ error: "Unable to update profile. Please try again." });
  }
});

router.post("/profile/picture", requireRole(profileRoles), uploadLimiter, async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const avatarUrl = req.body.avatarUrl ? String(req.body.avatarUrl).trim() : null;
    if (!avatarUrl) {
      return res.status(400).json({ error: "Please provide a valid profile image." });
    }

    const MAX_AVATAR_BYTES = 500 * 1024;
    let finalAvatarUrl = avatarUrl;
    if (avatarUrl.startsWith("data:")) {
      const parts = avatarUrl.split(",");
      const base64Data = parts[1] || "";
      const raw = Buffer.from(base64Data, "base64");
      const detectedMime = detectImageMimeType(raw);
      if (
        raw.length > MAX_AVATAR_BYTES ||
        !detectedMime ||
        !["image/png", "image/jpeg", "image/webp"].includes(detectedMime)
      ) {
        return res.status(400).json({
          error: "Invalid image or image exceeds 500KB limit. Only PNG, JPEG, and WebP are allowed.",
        });
      }
      if (raw.length > 50 * 1024) {
        const compressed = await compressPhotoBuffer(raw);
        finalAvatarUrl = `data:image/jpeg;base64,${compressed.toString("base64")}`;
      }
    } else if (/^https?:\/\//i.test(avatarUrl)) {
      if (avatarUrl.length > 2048) {
        return res.status(400).json({ error: "Avatar URL exceeds maximum allowed length." });
      }
    } else {
      return res.status(400).json({ error: "Invalid image format. Must be a valid image data URI or URL." });
    }

    await db.update(users).set({ avatarUrl: finalAvatarUrl, updatedAt: new Date() }).where(eq(users.id, user.id));
    await audit(user, "UPDATE_PROFILE_PICTURE", "user", user.id, null, null);

    res.json({
      success: true,
      message: "Profile picture updated successfully.",
      avatarUrl: finalAvatarUrl,
    });
  } catch (e) {
    console.error("[Profile Picture Error]", e);
    res.status(500).json({ error: "Unable to update profile picture. Please try again." });
  }
});

router.delete("/profile/picture", requireRole(profileRoles), async (_req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    await db.update(users).set({ avatarUrl: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    await audit(user, "REMOVE_PROFILE_PICTURE", "user", user.id, null, null);

    res.json({
      success: true,
      message: "Profile picture removed successfully.",
      avatarUrl: null,
    });
  } catch (e) {
    console.error("[Profile Picture Remove Error]", e);
    res.status(500).json({ error: "Unable to remove profile picture. Please try again." });
  }
});

router.post("/profile/password", requireRole(profileRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const currentPassword = String(req.body.currentPassword ?? "");
    const newPassword = String(req.body.newPassword ?? "");
    const confirmNewPassword = String(req.body.confirmNewPassword ?? req.body.confirmPassword ?? "");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: "All password fields are required." });
    }

    const freshUser = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    if (!freshUser || !freshUser.passwordHash) {
      return res.status(404).json({ error: "User account unavailable." });
    }

    const isCurrentValid = await verifyPassword(currentPassword, freshUser.passwordHash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: "Incorrect current password." });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters long." });
    }

    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: newHash, idPass: newPassword, updatedAt: new Date() }).where(eq(users.id, user.id));
    // Invalidate any unexpired password reset tokens for this user
    await db.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
    await audit(user, "CHANGE_PASSWORD", "user", user.id, null, null);

    // Fetch the updated user and sign a fresh session token
    const refreshedUser = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    const newToken = await signApplicationSession(refreshedUser ?? { ...user, passwordHash: newHash });
    await setApplicationSession(res, newToken);

    res.json({
      success: true,
      message: "Password changed successfully.",
      token: newToken,
    });
  } catch (e) {
    console.error("[Profile Password Error]", e);
    res.status(500).json({ error: "Unable to change password. Please try again." });
  }
});

export const profileRoutes = router;
