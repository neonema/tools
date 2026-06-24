import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  console.error(`brand:check failed - ${message}`);
  process.exit(1);
}

const rootDir = resolve(process.cwd());
const tokensPath = resolve(rootDir, "public/brand-tokens.css");
const stylesPath = resolve(rootDir, "public/styles.css");

let tokensCss = "";
let stylesCss = "";

try {
  tokensCss = readFileSync(tokensPath, "utf8");
} catch {
  fail("missing public/brand-tokens.css");
}

try {
  stylesCss = readFileSync(stylesPath, "utf8");
} catch {
  fail("missing public/styles.css");
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

if (!tokensCss.includes(":root")) {
  fail("public/brand-tokens.css must define :root tokens");
}

for (const line of requiredTokenLines) {
  if (!tokensCss.includes(line)) {
    fail(`missing locked token "${line}"`);
  }
}

if (!stylesCss.includes('@import url("./brand-tokens.css");')) {
  fail('public/styles.css must import "./brand-tokens.css"');
}

const lockStart = "/* BRAND_LOCK_START";
const lockEnd = "/* BRAND_LOCK_END */";
const start = stylesCss.indexOf(lockStart);
const end = stylesCss.indexOf(lockEnd);

if (start === -1 || end === -1 || end <= start) {
  fail("locked header block markers are missing or malformed");
}

const lockedBlock = stylesCss.slice(start, end);

const requiredLockedSnippets = [
  ".header {",
  "background: color-mix(in srgb, var(--header-bg) 84%, transparent);",
  "border-bottom: 1px solid var(--border);",
  ".header-inner {",
  "padding: 4px 16px;",
  ".brand img.brand-main {",
  "height: 50px;",
  ".brand img.brand-sub {",
  "height: 36px;",
  ".divider {",
  "height: 48px;",
  "@media (max-width: 768px) {",
  "padding: 4px 12px;",
  "height: 40px;",
  "height: 28px;",
  "height: 38px;",
];

for (const snippet of requiredLockedSnippets) {
  if (!lockedBlock.includes(snippet)) {
    fail(`locked header block drift detected (missing "${snippet}")`);
  }
}

const headerSelectorCount = (stylesCss.match(/\.header\s*\{/g) || []).length;
if (headerSelectorCount !== 1) {
  fail("expected exactly one .header selector in public/styles.css");
}

if (!stylesCss.includes("body {") || !stylesCss.includes("background: var(--background);")) {
  fail("body background must remain tied to var(--background)");
}

console.log("brand:check passed");
