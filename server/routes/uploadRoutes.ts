import path from "node:path";
import { Router } from "express";
import { uploadLimiter } from "../_core/rateLimit";
import { detectImageMimeType } from "../imageValidation";
import { adminRoles, currentUser, fail, schoolWriteRoles } from "./shared";

const router = Router();

router.post("/upload", uploadLimiter, async (req, res) => {
  try {
    const user = currentUser(res);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!schoolWriteRoles.has(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions: upload is restricted to administrators and operators" });
    }

    // Preserve school / tenant isolation
    const targetSchoolId = req.body?.schoolId ? Number(req.body.schoolId) : user.schoolId;
    if (!adminRoles.has(user.role)) {
      if (!user.schoolId || (req.body?.schoolId && targetSchoolId !== user.schoolId)) {
        return res.status(403).json({ error: "School access denied" });
      }
    }

    const { filename, contentType, dataBase64, kind } = req.body || {};
    if (!dataBase64 || typeof dataBase64 !== "string") {
      return res.status(400).json({ error: "dataBase64 is required" });
    }

    const cleanBase64 = dataBase64.includes(",") ? dataBase64.split(",")[1] : dataBase64;
    if (!cleanBase64.trim()) {
      return res.status(400).json({ error: "File content is empty" });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64 payload" });
    }

    if (buffer.length === 0) {
      return res.status(400).json({ error: "File content is empty" });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ error: "File exceeds 5MB size limit" });
    }

    const isCardPhoto =
      kind === "card photo" ||
      kind === "card_photo" ||
      kind === "PHOTO" ||
      (typeof kind === "string" && kind.toLowerCase().includes("card") && kind.toLowerCase().includes("photo"));
    if (isCardPhoto && buffer.length > 300 * 1024) {
      return res.status(400).json({ error: "Card photo exceeds 300KB size limit" });
    }

    // Safe MIME type detection via magic numbers - do not rely solely on client MIME
    const detectedMime = detectImageMimeType(buffer);
    if (!detectedMime) {
      return res.status(400).json({
        error: "Invalid file type. Only PNG, JPEG, WEBP, and GIF images are allowed",
      });
    }

    // If client supplied a contentType, ensure it is an image and doesn't conflict maliciously
    if (contentType && typeof contentType === "string") {
      const clientMime = contentType.toLowerCase().trim();
      if (!clientMime.startsWith("image/")) {
        return res.status(400).json({ error: "Invalid file type. Only image uploads are allowed" });
      }
    }

    // Sanitize filename and prevent directory traversal
    const extMap: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };
    const safeExt = extMap[detectedMime] || ".png";
    const rawName = typeof filename === "string" ? filename.replace(/[^a-zA-Z0-9._-]/g, "_") : `upload_${Date.now()}`;
    const baseName = path.basename(rawName).replace(/^\.+/, "") || `upload_${Date.now()}`;
    const finalName = baseName.toLowerCase().endsWith(safeExt) ? baseName : `${baseName}${safeExt}`;

    const dataUrl = `data:${detectedMime};base64,${cleanBase64}`;
    return res.json({ url: dataUrl });
  } catch (e) {
    fail(res, e);
  }
});

export const uploadRoutes = router;
