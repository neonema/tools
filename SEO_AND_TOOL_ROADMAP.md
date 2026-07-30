# NeoNema Tools — Growth Research

Research notes covering new tool ideas, keywords to run through SERP analysis, and SEO fixes.
Captured 2026-07-30. Current tools: RevealIP, UTC, JSON Toolkit.

---

## 1. Tool Suggestions

The architecture (static, client-side, privacy-first, one folder per tool via `scripts/scaffold-tool.mjs`)
is a strong fit for high-search-volume, zero-backend utilities — the DevUtils / CyberChef / it-tools niche.

### Tier 1 — natural extensions, high volume, low effort

- **Base64 encode/decode** — among the highest-volume dev utility searches
- **URL encode/decode**
- **JWT decoder** — big dev traffic; "decoded locally, never sent to a server" is a real selling point now that jwt.io is ad-heavy
- **UUID / GUID generator** (v4 + v7)
- **Hash generator** (MD5, SHA-1, SHA-256) — Web Crypto API handles this natively
- **Epoch / Unix timestamp converter** — pairs with the UTC tool; large search volume
- **JSON extensions** — JSON ↔ YAML, JSON ↔ CSV, JSON minify, JSON diff (deepens a cluster we already have)

### Tier 2 — strong volume, still trivially client-side

- **Word / character counter** — huge non-dev volume (students, writers, social media)
- **Lorem ipsum generator**
- **Password generator** — very high volume; the privacy story writes itself
- **QR code generator** — high volume; one small library, fully offline
- **Diff / text compare**
- **Regex tester**
- **Case converter** (camelCase, snake_case, Title Case, …)
- **Color converter / picker** (HEX ↔ RGB ↔ HSL)
- **Markdown preview / editor**
- **Cron expression parser**

### Tier 3 — differentiators that earn links

- **Image compressor / converter** (PNG ↔ WebP ↔ JPEG) — canvas API, fully in-browser; "compress image without uploading" is a growing privacy-conscious query
- **Timezone meeting planner** — natural upgrade of the UTC tool
- **HTML entity encoder/decoder**, HTML → text stripper
- **Number base converter** (hex/dec/bin/oct)
- **SQL formatter**
- **cURL → fetch/Python converter** — beloved by devs, links well

### Recommended first batch

Base64, epoch converter, JWT decoder, UUID generator, word counter, password generator.
Each is a day or less with the existing template, and together they cover both dev and mainstream intent.

---

## 2. Keyword List for SERP Research

Grouped into clusters. For each, check volume, difficulty, and who ranks — if page 1 is all
it-tools.tech / codebeautify / smallseotools clones, a focused fast page can compete.

### Existing tools — defend and expand

**IP:** what is my ip · whats my ip · my ip address · show my ip · ip lookup · ip checker ·
what is my ipv4 · what is my ipv6 · my public ip · check my ip location

**UTC:** utc time now · current utc time · utc converter · utc to est · utc to pst ·
utc to local time · gmt vs utc · zulu time · coordinated universal time · utc time zone converter

**JSON:** json formatter · json validator · json beautifier · json pretty print · json lint ·
json parser online · format json online · json viewer · json checker · json minify · json to csv ·
json to yaml · json diff · json escape · json stringify online

### Encoding / decoding

base64 encode · base64 decode · base64 to text · base64 to image · decode base64 online · base64 converter ·
url encode · url decode · url encoder online · percent encoding · decode url ·
jwt decoder · jwt decode online · decode jwt token · jwt parser · jwt viewer ·
html entity decoder · html encode · html escape · unescape html

### Generators

uuid generator · guid generator · random uuid · uuid v4 generator · uuid v7 · bulk uuid generator ·
password generator · random password generator · strong password generator · secure password generator · passphrase generator ·
lorem ipsum generator · placeholder text · dummy text generator ·
qr code generator · free qr code generator · qr code maker · url to qr code · wifi qr code generator ·
random number generator · random string generator · dice roller online

### Hashing

md5 generator · md5 hash · sha256 generator · sha256 online · sha1 hash · hash generator ·
checksum calculator · hmac generator

### Time (extends UTC tool)

epoch converter · unix timestamp converter · unix time to date · timestamp to date ·
current unix timestamp · epoch time now · milliseconds to date · iso 8601 converter · date to timestamp ·
time zone converter · time difference calculator · world clock · time in london · est to ist ·
pst to est · meeting time planner

### Text tools

word counter · character counter · letter counter · word count tool · sentence counter ·
character count for twitter · count words online ·
case converter · uppercase to lowercase · title case converter · camelcase converter · snake case converter ·
text compare · diff checker · compare two texts · diff tool online · text difference checker ·
remove duplicate lines · sort lines alphabetically · remove line breaks · text cleaner · whitespace remover ·
reverse text · text repeater · find and replace online

### Dev tools

regex tester · regex101 alternative · regular expression tester · regex match online ·
cron expression · crontab generator · cron every 5 minutes · cron syntax · cron parser ·
sql formatter · format sql online · sql beautifier ·
curl to python · curl converter · curl to fetch ·
number base converter · hex to decimal · binary to decimal · decimal to hex · binary translator ·
markdown editor online · markdown preview · markdown to html ·
css minifier · js minifier · html formatter · xml formatter · xml to json

### Design

color picker · hex to rgb · rgb to hex · hsl to hex · color converter · color palette generator ·
contrast checker · wcag contrast checker

### Image (higher effort, higher reward)

image compressor · compress image online · compress jpeg · png to webp · webp to png ·
image converter online · resize image online · compress image without losing quality · heic to jpg

### Modifier patterns to test against the best clusters

These surface the low-competition long tail:

- `[tool] online`, `[tool] free`, `free online [tool]`
- `[tool] no ads`, `[tool] without upload`, `[tool] offline`
- `best [tool]`, `[tool] chrome extension`
- `[competitor] alternative` — e.g. jwt.io alternative, regex101 alternative, epochconverter alternative

**Prioritization rule of thumb:** long-tail dev queries convert to repeat users (devs bookmark utilities),
while mainstream queries (word counter, password generator) bring volume but face entrenched competition.
Look for clusters with decent volume (1K–50K/mo) where page 1 is weak, ad-riddled pages.

---

## 3. SEO Fixes

### Critical — current architecture blocks per-tool ranking

Tool pages redirect standalone visits to hash routes (`apps/json/public/index.html`, the inline
script around line 26) and set `<link rel="canonical" href="https://tools.neonema.com/#/json">`.
Google ignores URL fragments, so `/#/json` is just the homepage to a crawler. Effectively all three
tools canonicalize to a single page and none can rank for their own keywords. Highest-impact fix
available:

1. **Give every tool a real, crawlable path** (`/json/`, `/utc/`, `/revealip/`) that renders full
   content at that URL — no redirect to a hash route. The hub tabs can stay, but make them real
   links to real paths and hijack clicks client-side via the History API for SPA feel.
   Independent per-tool ranking is the entire growth model of it-tools, codebeautify, et al.
2. **Canonical per tool** pointing at the real path, not the fragment.
3. **Add `sitemap.xml`** — none exists in `dist/` today. List every tool URL, reference it from
   `robots.txt`, and submit the site in Google Search Console.

### On-page, per tool

4. **Title pattern: primary keyword first.**
   `JSON Formatter & Validator — Free, Private, In-Browser | NeoNema` beats
   `JSON Utility Toolkit - by NeoNema`. Same for RevealIP — the query is "what is my IP", so the
   title should contain that phrase.
5. **Add real text content below each tool** — 300–600 words. Pages that are 100% JS widget with no
   crawlable prose struggle. Cover what it does, how it works, and an FAQ ("Is my JSON uploaded
   anywhere? No — everything runs in your browser"). This is also where long-tail keywords land
   naturally.
6. **Structured data** — `SoftwareApplication` or `WebApplication` JSON-LD per tool, plus `FAQPage`
   markup for FAQ sections. FAQ rich results still win real estate on utility queries.
7. **Lead with the privacy angle everywhere.** "No upload, no tracking, works offline" is both a
   ranking hook (`json formatter no ads`, `compress image without uploading`) and a conversion hook
   against ad-farm competitors.

### Site structure

8. **Homepage as a crawlable directory** of all tools with descriptive `<a href>` cards — the tab
   list is currently built by `app.js`, so confirm real links exist in the served HTML source.
9. **Interlink related tools** ("Also try: JSON to YAML, JSON Diff"). This builds topical clusters,
   and Google rewards owning a whole cluster over scattered one-offs.
10. **Path clusters as tools grow** — `/json/format`, `/json/diff`, `/json/to-yaml`, each its own
    indexed page targeting its own query.

### Technical polish

11. **Self-host the Outfit font** — currently loaded from Google Fonts, a render-blocking
    third-party request. Self-hosting improves LCP and keeps the privacy story consistent.
12. **Open Graph / Twitter card tags per tool** — dev tools spread through Slack and Discord links.
13. **Stay static and fast.** The site is positioned for near-perfect Core Web Vitals in a niche
    where competitors are ad-heavy and slow.

### Realistic expectations

Head terms (`what is my ip`, `json formatter`) are dominated by high-authority sites. Wins come from
the long tail (`jwt decoder offline`, `json to yaml no upload`, `epoch converter milliseconds`) and
from having many decent pages rather than three great ones. Ship tools in clusters, fix hash routing
first, and let Search Console data decide which clusters to deepen.
