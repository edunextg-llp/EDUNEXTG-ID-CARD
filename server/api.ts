import { Router } from "express";
import { authenticatedApiLimiter } from "./_core/rateLimit";
import { sanitizeForAudit } from "./auditSanitize";
import { auth, currentUser, partnerRoles } from "./routes/shared";
import { authRoutes } from "./routes/authRoutes";
import { profileRoutes } from "./routes/profileRoutes";
import { schoolRoutes } from "./routes/schoolRoutes";
import { userRoutes } from "./routes/userRoutes";
import { templateRoutes, schoolTemplateRoutes } from "./routes/templateRoutes";
import { uploadRoutes } from "./routes/uploadRoutes";
import { idCardRoutes } from "./routes/idCardRoutes";
import { approvalRoutes, approvalListRoutes } from "./routes/approvalRoutes";
import { idCardPrintRoutes } from "./routes/idCardPrintRoutes";
import { notificationRoutes } from "./routes/notificationRoutes";
import { auditRoutes } from "./routes/auditRoutes";
import { reportRoutes } from "./routes/reportRoutes";
import { idCardRequestRoutes } from "./routes/idCardRequestRoutes";
import { orderRoutes } from "./routes/orderRoutes";

export { sanitizeForAudit };

const router = Router();

// ─── PUBLIC AUTH ROUTES ────────────────────────────────────────────────────
router.use(authRoutes);

// ─── AUTHENTICATION & RATE LIMITING MIDDLEWARE ─────────────────────────────
router.use(auth);
router.use(authenticatedApiLimiter);

// Restrict Partner to auth, profile, notifications, orders, schools, and about
router.use((req, res, next) => {
  const user = currentUser(res);
  if (user && partnerRoles.has(user.role)) {
    const p = req.path;
    const isAllowed =
      p === "/profile" ||
      p.startsWith("/profile/") ||
      p === "/notifications" ||
      p.startsWith("/notifications/") ||
      p === "/orders" ||
      p.startsWith("/orders/") ||
      p === "/schools" ||
      p.startsWith("/schools/") ||
      p === "/about";

    if (!isAllowed) {
      return res.status(403).json({ error: "Insufficient permissions for partner" });
    }
  }
  next();
});

// ─── MOUNTED ROUTE MODULES ────────────────────────────────────────────────
router.use(profileRoutes);
router.use(schoolRoutes);
router.use(userRoutes);
router.use(templateRoutes);
router.use(uploadRoutes);
router.use(schoolTemplateRoutes);
router.use(idCardRoutes);
router.use(approvalRoutes);
router.use(idCardPrintRoutes);
router.use(notificationRoutes);
router.use(auditRoutes);
router.use(reportRoutes);
router.use(approvalListRoutes);
router.use(idCardRequestRoutes);
router.use(orderRoutes);

export const apiRouter = router;
