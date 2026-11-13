import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiRouter } from "../server/api";
import { flattenRouter } from "./dump-routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const current = flattenRouter(apiRouter);
const beforeRaw = fs.readFileSync(path.join(__dirname, "routes-before.json"), "utf8");
const before = JSON.parse(beforeRaw);

console.log(`Current items: ${current.length}, Before items: ${before.length}`);

let matches = true;
if (current.length !== before.length) {
  console.error(`Mismatch in length: ${current.length} vs ${before.length}`);
  matches = false;
}

const len = Math.max(current.length, before.length);
for (let i = 0; i < len; i++) {
  const c = current[i];
  const b = before[i];
  if (JSON.stringify(c) !== JSON.stringify(b)) {
    console.error(`Mismatch at index ${i}:`);
    console.error("  Before: ", JSON.stringify(b));
    console.error("  Current:", JSON.stringify(c));
    matches = false;
  }
}

if (matches) {
  console.log("SUCCESS: Route stacks match exactly!");
  process.exit(0);
} else {
  console.error("FAILURE: Route stacks differ.");
  process.exit(1);
}
