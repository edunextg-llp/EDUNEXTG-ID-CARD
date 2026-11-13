import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiRouter } from "../server/api";
import { flattenRouter, type FlatRouteItem } from "./dump-routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const before: FlatRouteItem[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "routes-before.json"), "utf8")
);
const after: FlatRouteItem[] = flattenRouter(apiRouter);

function formatItem(item: FlatRouteItem, idx: number): string {
  if (item.type === "route") {
    const handlers = (item.handlers || []).join(" -> ");
    return `[${idx.toString().padStart(2, "0")}] ROUTE:      ${item.method?.padEnd(6)} ${item.path?.padEnd(45)} (handlers: ${handlers})`;
  } else {
    return `[${idx.toString().padStart(2, "0")}] MIDDLEWARE: ${item.name}`;
  }
}

console.log("=== BEFORE REFACTOR (" + before.length + " entries) ===");
before.forEach((item, i) => console.log(formatItem(item, i)));

console.log("\n=== AFTER REFACTOR (" + after.length + " entries) ===");
after.forEach((item, i) => console.log(formatItem(item, i)));

console.log("\n=== COMPARISON RESULT ===");
const matches = JSON.stringify(before) === JSON.stringify(after);
console.log(`Identical: ${matches}`);
if (!matches) {
  process.exit(1);
}
