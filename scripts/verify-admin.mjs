import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const requiredFiles = [
  "src/admin-worker.js",
  "src/admin/pages.js",
  "src/admin/security.js",
  "wrangler.admin.jsonc",
  "migrations/0001_analytics_and_admin.sql",
];

await Promise.all(requiredFiles.map((file) => access(path.resolve(file), constants.R_OK)));
console.log("Admin Worker source and configuration verified.");
