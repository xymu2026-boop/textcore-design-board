import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = ["src/main.tsx", "src/App.tsx"];
const missing = requiredFiles.filter((file) => !existsSync(join(process.cwd(), file)));

if (missing.length > 0) {
  console.error(`Missing required frontend files: ${missing.join(", ")}`);
  process.exit(1);
}

const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

if (!appSource.includes("TextCore app shell")) {
  console.error("App shell aria label is missing.");
  process.exit(1);
}
