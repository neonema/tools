import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

function fail(message) {
  console.error(`brand:check failed - ${message}`);
  process.exit(1);
}

function normalizeCss(css) {
  return css.replace(/\r\n/g, "\n").trim();
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const rootDir = resolve(process.cwd());
const canonicalTokensPath = resolve(rootDir, "packages/brand/brand-tokens.css");
const canonicalLogoPath = resolve(rootDir, "packages/brand/NeoNema.png");
const canonicalHeaderLockPath = resolve(rootDir, "packages/brand/header-lock.css");

let canonicalTokens = "";
let canonicalHeaderLock = "";
let canonicalLogoHash = "";

try {
  canonicalTokens = readFileSync(canonicalTokensPath, "utf8");
} catch {
  fail("missing packages/brand/brand-tokens.css");
}

try {
  canonicalHeaderLock = readFileSync(canonicalHeaderLockPath, "utf8");
} catch {
  fail("missing packages/brand/header-lock.css");
}

try {
  canonicalLogoHash = fileSha256(canonicalLogoPath);
} catch {
  fail("missing packages/brand/NeoNema.png");
}

const requiredTokenLines = [
  "--background: #0b0f0d;",
  "--foreground: #ffffff;",
  "--card: #18211d;",
  "--primary: #39d98a;",
  "--muted: #9da7a2;",
  "--border: #25322d;",
  "--header-bg: #111815;",
];

const requiredLockedSnippets = [
  ".header {",
  "background: color-mix(in srgb, var(--header-bg) 84%, transparent);",
  "border-bottom: 1px solid var(--border);",
  ".header-inner {",
  "padding: 4px 16px;",
  ".brand img.brand-main {",
  "height: 50px;",
  "@media (max-width: 768px) {",
  "padding: 4px 12px;",
  "height: 40px;",
];

function discoverAppPublicDirs() {
  const appsDir = resolve(rootDir, "apps");
  const dirs = [];

  for (const entry of readdirSync(appsDir)) {
    const publicDir = join(appsDir, entry, "public");
    try {
      if (statSync(publicDir).isDirectory()) {
        dirs.push({ name: entry, publicDir });
      }
    } catch {
      // skip entries without a public/ folder
    }
  }

  const templatePublic = resolve(rootDir, "packages/utility-template/public");
  try {
    if (statSync(templatePublic).isDirectory()) {
      dirs.push({ name: "utility-template", publicDir: templatePublic });
    }
  } catch {
    // template package is optional
  }

  if (dirs.length === 0) {
    fail("no app public directories found under apps/*/public");
  }

  return dirs;
}

function extractLockedBlock(stylesCss) {
  const lockStart = "/* BRAND_LOCK_START";
  const lockEnd = "/* BRAND_LOCK_END */";
  const start = stylesCss.indexOf(lockStart);
  const end = stylesCss.indexOf(lockEnd);

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return stylesCss.slice(start, end + lockEnd.length);
}

// The hub is a tab shell with no tool page of its own; each embedded tool
// supplies the privacy note.
const privacyNoteExemptApps = new Set(["hub"]);

function checkPrivacyNote({ name, publicDir }, stylesCss) {
  if (privacyNoteExemptApps.has(name)) return;

  const indexPath = join(publicDir, "index.html");
  let indexHtml = "";
  try {
    indexHtml = readFileSync(indexPath, "utf8");
  } catch {
    fail(`${name}: missing public/index.html`);
  }

  if (!indexHtml.includes('class="privacy-note"')) {
    fail(`${name}: index.html must include the privacy note (<p class="privacy-note">)`);
  }

  if (!indexHtml.includes("Private by design.")) {
    fail(`${name}: privacy note must open with "Private by design."`);
  }

  if (!indexHtml.includes("NeoNema never")) {
    fail(`${name}: privacy note must state what NeoNema never sees/logs`);
  }

  if (/html\.hub-embed[^{]*\.privacy-note/.test(stylesCss)) {
    fail(`${name}: styles.css must not hide .privacy-note in hub-embed mode`);
  }

  if (!/\.privacy-note\s*[,{]/.test(stylesCss)) {
    fail(`${name}: styles.css must style .privacy-note`);
  }
}

function checkApp({ name, publicDir }) {
  const tokensPath = join(publicDir, "brand-tokens.css");
  const stylesPath = join(publicDir, "styles.css");
  const logoPath = join(publicDir, "NeoNema.png");

  let tokensCss = "";
  let stylesCss = "";

  try {
    tokensCss = readFileSync(tokensPath, "utf8");
  } catch {
    fail(`${name}: missing public/brand-tokens.css`);
  }

  try {
    stylesCss = readFileSync(stylesPath, "utf8");
  } catch {
    fail(`${name}: missing public/styles.css`);
  }

  try {
    const logoHash = fileSha256(logoPath);
    if (logoHash !== canonicalLogoHash) {
      fail(`${name}: NeoNema.png does not match packages/brand/NeoNema.png (run npm run sync-brand)`);
    }
  } catch {
    fail(`${name}: missing public/NeoNema.png`);
  }

  if (normalizeCss(tokensCss) !== normalizeCss(canonicalTokens)) {
    fail(`${name}: brand-tokens.css does not match packages/brand/brand-tokens.css (run npm run sync-brand)`);
  }

  if (!tokensCss.includes(":root")) {
    fail(`${name}: brand-tokens.css must define :root tokens`);
  }

  for (const line of requiredTokenLines) {
    if (!tokensCss.includes(line)) {
      fail(`${name}: missing locked token "${line}"`);
    }
  }

  if (!stylesCss.includes('@import url("./brand-tokens.css");')) {
    fail(`${name}: styles.css must import "./brand-tokens.css"`);
  }

  const lockedBlock = extractLockedBlock(stylesCss);
  if (!lockedBlock) {
    fail(`${name}: locked header block markers are missing or malformed`);
  }

  if (normalizeCss(lockedBlock) !== normalizeCss(canonicalHeaderLock)) {
    fail(`${name}: locked header block does not match packages/brand/header-lock.css`);
  }

  for (const snippet of requiredLockedSnippets) {
    if (!lockedBlock.includes(snippet)) {
      fail(`${name}: locked header block drift detected (missing "${snippet}")`);
    }
  }

  // Only the bare `.header {` rule is locked. Compound selectors such as
  // `body > .header {` or `html.hub-embed .header,` are app-level refinements
  // and do not redefine the locked rule itself.
  const headerSelectorCount = (stylesCss.match(/^\s*\.header\s*\{/gm) || []).length;
  if (headerSelectorCount !== 1) {
    fail(`${name}: expected exactly one bare .header selector in styles.css`);
  }

  if (!stylesCss.includes("body {") || !stylesCss.includes("background: var(--background);")) {
    fail(`${name}: body background must remain tied to var(--background)`);
  }

  checkPrivacyNote({ name, publicDir }, stylesCss);

  console.log(`  ✓ ${name}`);
}

const appDirs = discoverAppPublicDirs();
console.log(`brand:check scanning ${appDirs.length} app(s)...`);
for (const app of appDirs) {
  checkApp(app);
}
console.log("brand:check passed");
