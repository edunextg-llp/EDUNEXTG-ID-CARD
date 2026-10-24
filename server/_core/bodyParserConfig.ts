import express, { type Express } from "express";

export const LARGE_BODY_LIMIT = "50mb";
export const GLOBAL_BODY_LIMIT = "100kb";

export const LARGE_BODY_ROUTES = [
  { method: "POST", path: "/api/upload" },
  { method: "POST", path: "/api/id-card-requests/bulk-upload-photos" },
  { method: "POST", path: "/api/id-cards/bulk-upload-photos" },
  { method: "POST", path: "/api/id-card-requests/upload-excel" },
  { method: "POST", path: "/api/id-cards/:id/files" },
  { method: "POST", path: "/api/profile/picture" },
  { method: "POST", path: "/api/id-cards" },
  { method: "PUT", path: "/api/id-cards/:id" },
  { method: "PATCH", path: "/api/id-cards/:id" },
  { method: "POST", path: "/api/id-card-requests" },
  { method: "PUT", path: "/api/id-card-requests/:id" },
  { method: "PATCH", path: "/api/id-card-requests/:id" },
  { method: "POST", path: "/api/templates" },
  { method: "PUT", path: "/api/templates/:id" },
  { method: "PATCH", path: "/api/templates/:id" },
] as const;

/**
 * Configures Express request body parsers.
 * - Mounts route-specific parsers with 50mb limit BEFORE the global parser for
 *   routes accepting files, base64 images, or large template element configurations.
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

  app.use(express.json({ limit: GLOBAL_BODY_LIMIT }));
  app.use(express.urlencoded({ limit: GLOBAL_BODY_LIMIT, extended: true }));
}
