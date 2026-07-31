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
  { label: "word-token-counter", source: "apps/word-token-counter/public", dest: "word-token-counter" },
  { label: "base64", source: "apps/base64/public", dest: "base64" },
  { label: "url-encode", source: "apps/url-encode/public", dest: "url-encode" },
  { label: "jwt", source: "apps/jwt/public", dest: "jwt" },
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

// The hub <noscript> list is the crawlable fallback when JS is off, so it cannot be
// rendered from hub.config.json at runtime. Fail the build if the two drift apart.
const hubIndex = readFileSync(join(distDir, "index.html"), "utf8");
const noscriptBlock = hubIndex.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? "";
const linkedIds = [...noscriptBlock.matchAll(/href="\/([^/"]+)\/"/g)].map((match) => match[1]);

const missingIds = toolIds.filter((id) => !linkedIds.includes(id));
const staleIds = linkedIds.filter((id) => !toolIds.includes(id));
if (missingIds.length || staleIds.length) {
  console.error("build: hub <noscript> links are out of sync with hub.config.json");
  if (missingIds.length) console.error(`  missing: ${missingIds.join(", ")}`);
  if (staleIds.length) console.error(`  stale:   ${staleIds.join(", ")}`);
  console.error("  fix apps/hub/public/index.html: <li><a href=\"/<tool-id>/\">Label</a></li>");
  process.exit(1);
}
console.log("  ✓ hub noscript links match hub.config.json");

console.log("build: dist/ ready");
