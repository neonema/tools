import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");

/** @type {{ label: string; source: string; dest: string }[]} */
const APPS = [
  { label: "hub", source: "apps/hub/public", dest: "" },
  { label: "json", source: "apps/json/public", dest: "json" },
  { label: "revealip", source: "apps/revealip/public", dest: "revealip" },
];

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

for (const app of APPS) {
  const src = resolve(rootDir, app.source);
  const dest = app.dest ? resolve(distDir, app.dest) : distDir;

  if (!existsSync(src)) {
    console.error(`build: missing source directory ${app.source}`);
    process.exit(1);
  }

  cpSync(src, dest, { recursive: true });
  console.log(`  ✓ ${app.label} → ${app.dest ? `${app.dest}/` : "/"}`);
}

const hubConfigPath = resolve(rootDir, "apps/hub/hub.config.json");
if (!existsSync(hubConfigPath)) {
  console.error("build: missing apps/hub/hub.config.json");
  process.exit(1);
}
cpSync(hubConfigPath, join(distDir, "hub.config.json"));
console.log("  ✓ hub.config.json → /");

console.log("build: dist/ ready");
