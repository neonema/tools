import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { injectToolNav, readHubConfig } from "./lib/tool-nav.mjs";
import { injectBuildStamp, resolveBuildCommit } from "./lib/build-stamp.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");
const SITE_ORIGIN = "https://tools.neonema.com";

/** @type {{ label: string; source: string; dest: string }[]} */
const APPS = [
  { label: "hub", source: "apps/hub/public", dest: "" },
  { label: "json", source: "apps/json/public", dest: "json" },
  { label: "column-to-list", source: "apps/column-to-list/public", dest: "column-to-list" },
  { label: "mermaid", source: "apps/mermaid/public", dest: "mermaid" },
  { label: "revealip", source: "apps/revealip/public", dest: "revealip" },
  { label: "utc", source: "apps/utc/public", dest: "utc" },
  { label: "epoch", source: "apps/epoch/public", dest: "epoch" },
  { label: "cron", source: "apps/cron/public", dest: "cron" },
  { label: "word-token-counter", source: "apps/word-token-counter/public", dest: "word-token-counter" },
  { label: "base64", source: "apps/base64/public", dest: "base64" },
  { label: "url-encode", source: "apps/url-encode/public", dest: "url-encode" },
  { label: "jwt", source: "apps/jwt/public", dest: "jwt" },
  { label: "password", source: "apps/password/public", dest: "password" },
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

// Every entry page gets the grouped category nav baked in: the hub at `/` and
// each standalone tool, so a direct visit to `/utc/` shows the same nav as `/`.
// Inside the hub iframe the whole header is hidden (html.hub-embed), so this
// never double-renders. readHubConfig() also validates categories.
let hubConfig;
try {
  hubConfig = readHubConfig();
} catch (error) {
  console.error(`build: ${error.message}`);
  process.exit(1);
}
const hubToolIds = new Set(hubConfig.tools.map((tool) => tool.id));

for (const app of APPS) {
  if (app.dest && !hubToolIds.has(app.dest)) continue;

  const indexPath = app.dest ? resolve(distDir, app.dest, "index.html") : resolve(distDir, "index.html");
  if (!existsSync(indexPath)) {
    console.error(`build: ${app.label} has no index.html to inject nav into`);
    process.exit(1);
  }

  try {
    writeFileSync(indexPath, injectToolNav(readFileSync(indexPath, "utf8"), app.dest || null, hubConfig));
  } catch (error) {
    console.error(`build: ${error.message}`);
    process.exit(1);
  }
}

const unregistered = APPS.filter((app) => app.dest && !hubToolIds.has(app.dest)).map((a) => a.dest);
if (unregistered.length) {
  console.log(`  ! not in hub.config.json, shipped without nav: ${unregistered.join(", ")}`);
}
console.log(`  ✓ category nav injected into hub + ${hubToolIds.size} tool pages`);

// Build stamp: every page footer names the deployed commit, and /version.json
// reports it, so anyone can confirm which commit the CDN is serving.
const buildCommit = resolveBuildCommit();
for (const app of APPS) {
  const indexPath = app.dest ? resolve(distDir, app.dest, "index.html") : resolve(distDir, "index.html");
  if (!existsSync(indexPath)) continue;
  try {
    writeFileSync(indexPath, injectBuildStamp(readFileSync(indexPath, "utf8"), buildCommit));
  } catch (error) {
    console.error(`build: ${app.label}: ${error.message}`);
    process.exit(1);
  }
}
writeFileSync(
  join(distDir, "version.json"),
  `${JSON.stringify({ commit: buildCommit, builtAt: new Date().toISOString() }, null, 2)}\n`,
);
console.log(`  ✓ build stamp ${buildCommit.slice(0, 7)} → ${APPS.length} pages + version.json`);

const hubConfigPath = resolve(rootDir, "apps/hub/hub.config.json");
if (!existsSync(hubConfigPath)) {
  console.error("build: missing apps/hub/hub.config.json");
  process.exit(1);
}
cpSync(hubConfigPath, join(distDir, "hub.config.json"));
console.log("  ✓ hub.config.json → /");

const toolIds = [...hubToolIds];

const XML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (value) => value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);

const sitemapUrls = [
  `${SITE_ORIGIN}/`,
  ...toolIds.map((id) => `${SITE_ORIGIN}/${encodeURIComponent(id)}/`),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(distDir, "sitemap.xml"), sitemap);
console.log("  ✓ sitemap.xml → /");

console.log("build: dist/ ready");
