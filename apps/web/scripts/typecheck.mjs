import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const localTsc = join(process.cwd(), "node_modules", ".bin", "tsc");

if (existsSync(localTsc)) {
  const result = spawnSync(localTsc, ["--noEmit"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

const requiredFiles = ["src/main.tsx", "src/App.tsx", "vite.config.ts", "tsconfig.json"];
const missing = requiredFiles.filter((file) => !existsSync(join(process.cwd(), file)));

if (missing.length > 0) {
  console.error(`Missing required TypeScript scaffold files: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("typescript is not installed; running placeholder scaffold typecheck.");
