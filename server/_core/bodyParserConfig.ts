import express, { type Express } from "express";

export const LARGE_BODY_LIMIT = "50mb";
export const AVATAR_BODY_LIMIT = "2mb";
export const GLOBAL_BODY_LIMIT = "100kb";

export const LARGE_BODY_ROUTES = [
  { method: "POST", path: "/api/upload" },
  { method: "POST", path: "/api/id-card-requests/bulk-upload-photos" },
  { method: "POST", path: "/api/id-cards/bulk-upload-photos" },
  { method: "POST", path: "/api/id-card-requests/upload-excel" },
  { method: "POST", path: "/api/id-cards/:id/files" },
  { method: "POST", path: "/api/id-cards" },
  { method: "PUT", path: "/api/id-cards/:id" },
  { method: "POST", path: "/api/templates" },
  { method: "PUT", path: "/api/templates/:id" },
] as const;

/**
 * Configures Express request body parsers.
 * - Mounts route-specific parsers with 50mb limit BEFORE the global parser for
 *   routes accepting files, base64 bulk images, or large template element configurations.
 * - Mounts a 2mb limit parser for user profile picture uploads.
 * - Mounts global json and urlencoded parsers with 100kb limit for all other routes.
 */
export function configureBodyParsers(app: Express) {
  const largeJsonParser = express.json({ limit: LARGE_BODY_LIMIT });
  const largeUrlencodedParser = express.urlencoded({ limit: LARGE_BODY_LIMIT, extended: true });

  for (const { method, path } of LARGE_BODY_ROUTES) {
    if (method === "POST") {
      app.post(path, largeJsonParser, largeUrlencodedParser);
    } else if (method === "PUT") {
      app.put(path, largeJsonParser, largeUrlencodedParser);
    } else if (method === "PATCH") {
      app.patch(path, largeJsonParser, largeUrlencodedParser);
    }
  }

  // Profile picture parser strictly bounded to 2mb to avoid memory exhaustion DoS
  const avatarJsonParser = express.json({ limit: AVATAR_BODY_LIMIT });
  const avatarUrlencodedParser = express.urlencoded({ limit: AVATAR_BODY_LIMIT, extended: true });
  app.post("/api/profile/picture", avatarJsonParser, avatarUrlencodedParser);

  app.use(express.json({ limit: GLOBAL_BODY_LIMIT }));
  app.use(express.urlencoded({ limit: GLOBAL_BODY_LIMIT, extended: true }));
}
