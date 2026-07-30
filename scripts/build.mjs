import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");
const SITE_ORIGIN = "https://tools.neonema.com";

/** @type {{ label: string; source: string; dest: string }[]} */
const APPS = [
  { label: "hub", source: "apps/hub/public", dest: "" },
  { label: "json", source: "apps/json/public", dest: "json" },
  { label: "revealip", source: "apps/revealip/public", dest: "revealip" },
  { label: "utc", source: "apps/utc/public", dest: "utc" },
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

/** @type {{ tools?: { id: string }[] }} */
const hubConfig = JSON.parse(readFileSync(hubConfigPath, "utf8"));
const toolIds = Array.isArray(hubConfig.tools) ? hubConfig.tools.map((t) => t.id).filter(Boolean) : [];

const sitemapUrls = [`${SITE_ORIGIN}/`, ...toolIds.map((id) => `${SITE_ORIGIN}/${id}/`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(distDir, "sitemap.xml"), sitemap);
console.log("  ✓ sitemap.xml → /");

console.log("build: dist/ ready");
