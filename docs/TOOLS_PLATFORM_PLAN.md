# NeoNema Tools Platform — Plan & Checklist

Strategic plan for turning `neonema-tools` into the single source of truth for all NeoNema utility products, served from **tools.neonema.com** with fast, repeatable deploys.

**Status:** Planning (post Phase 3 monorepo migration)  
**Last updated:** 2026-06-24

Each priority section (P0–P7) ends with **Step verification**: for every checklist item, an **Explanation** (what “done” means) and **Manual verification** commands or browser steps you can run to confirm that phase work succeeded.

---

## Goals (your requirements)

| # | Requirement | Summary |
|---|-------------|---------|
| 1 | Main repo | `neonema-tools` owns all tools, templates, deploy automation, and docs |
| 2 | Static CDN tools | Each tool is a one-page site; no NeoNema backend; no user data stored or relayed |
| 3 | Primary URL | Public tools hub lives at **tools.neonema.com** |
| 4 | Legacy domains | **neonema-revealip.com** and **neonema-json.com** redirect to the new hub |
| 5 | Tab per tool | The hub exposes each tool as its own tab (client-side, no server routing) |
| 6 | Company site | **neonema.com** stays corporate; links out to tools.neonema.com |
| 7 | Fast deploy platform | Templates, scripts, and runbooks to ship a new tool in hours, not days |
| 8 | GitHub → AWS | Push/merge to `main` deploys production from GitHub Actions |
| 9 | Dev environment | A separate dev/staging URL for pre-production validation |

---

## Recommended architecture

### Hosting model (single origin)

Use **one S3 bucket + one CloudFront distribution** for `tools.neonema.com`. Each tool is a static subtree; the hub is the site root.

```
tools.neonema.com/              → apps/hub/public/          (tab shell + tool picker)
tools.neonema.com/json/         → apps/json/public/         (JSON Toolkit)
tools.neonema.com/revealip/     → apps/revealip/public/     (RevealIP)
```

**Build step:** a deploy script assembles `dist/` (or syncs prefixes) from each app before `aws s3 sync`.

**Why one origin:** one ACM cert, one invalidation target, one GitHub deploy workflow, simpler DNS. Tools remain independent folders in the monorepo.

### Tab model

The hub (`apps/hub/`) is a lightweight static shell:

- Fixed NeoNema header (shared brand lock)
- Horizontal tab bar: JSON · RevealIP · (future tools)
- Clicking a tab shows that tool’s panel **without a full page reload** (hash or `history.pushState` routes like `#/json`, `#/revealip`)
- Deep links: `tools.neonema.com/#/json` and legacy redirects land on the correct tab
- Each tool panel can be an **iframe** pointing at `/json/index.html` etc., or **inlined static HTML** copied at build time — start with iframes for speed, migrate to inlined modules if you want zero nested documents

### CDN-only / no data transfer constraint

| Allowed | Not allowed (without explicit approval) |
|---------|----------------------------------------|
| Static files from CloudFront | NeoNema API servers, databases, Lambdas (except documented edge exceptions) |
| All tool logic in browser (`app.js`) | Sending user input to NeoNema infrastructure |
| Third-party edge/CDN (CloudFront, Cloudflare) | Logging pipelines that store user content |
| Google AdSense (third-party, optional) | Analytics that exfiltrate tool input |

**Documented exception — RevealIP:** `/api/ip` is served by a **CloudFront Function** at the edge. It returns the viewer’s public IP to the browser only; NeoNema does not persist it. Keep this as the only edge compute path unless a future tool has an equally narrow, documented exception.

### Domain map

| Hostname | Role | Repo ownership |
|----------|------|----------------|
| `tools.neonema.com` | Tools hub + all tools (production) | `neonema-tools` |
| `dev.tools.neonema.com` | Staging / preview (placeholder) | `neonema-tools` |
| `neonema-revealip.com` | 301 → `https://tools.neonema.com/#/revealip` | DNS redirect only |
| `neonema-json.com` | 301 → `https://tools.neonema.com/#/json` | DNS redirect only |
| `neonema.com` | Company marketing site | Separate repo/project; add “Tools” nav link |

### AWS layout (target)

```
NeoNema LLC AWS account
├── S3: neonema-tools-prod        (tools.neonema.com)
├── S3: neonema-tools-dev         (dev.tools.neonema.com)
├── CloudFront: tools-prod        (OAC → prod bucket)
├── CloudFront: tools-dev         (OAC → dev bucket)
├── ACM (us-east-1): *.neonema.com + neonema.com
└── IAM: GitHub OIDC role         (deploy on push to main / dev)
```

Legacy per-app buckets/distributions can be retired after cutover and redirect verification.

---

## Priority tiers

Work top-to-bottom. Later tiers depend on earlier ones.

| Priority | Theme | Items covered | Outcome |
|----------|-------|---------------|---------|
| **P0** | Decisions & guardrails | 1, 2 | Everyone builds the same way; constraints are written down |
| **P1** | Production hosting | 3, 8 (infra half) | `tools.neonema.com` exists and is deployable |
| **P2** | Hub UX & tool integration | 5 | Users pick tools via tabs on one page |
| **P3** | Legacy cutover | 4 | Old domains redirect; old AWS stacks can be decommissioned |
| **P4** | Platform velocity | 7 | New tool scaffold → prod in a repeatable pipeline |
| **P5** | CI/CD automation | 8 (GitHub half) | No local AWS creds required for routine deploys |
| **P6** | Dev / staging | 9 | Safe preview URL before production |
| **P7** | Company site link | 6 | neonema.com points visitors to the tools hub |

---

## P0 — Platform decisions & guardrails

**Covers:** requirements 1, 2  
**Effort:** ~0.5 day (mostly documentation + small repo tweaks)  
**Blocks:** everything else

### Checklist

- [x] **P0.1** Adopt single-origin deploy model (`tools.neonema.com` bucket layout above) as the default in all new docs
- [x] **P0.2** Add `docs/platform/ARCHITECTURE.md` — static-only rules, RevealIP edge exception, tab routing spec
- [x] **P0.3** Update `AGENTS.md` and `LLM_PRODUCT_RULES.md` with hub path (`apps/hub/`), deploy target (`dist/` or prefix sync), and “no backend” rule
- [x] **P0.4** Mark `neonema-tools` README as the canonical repo; note old `neonema` / per-app repos are archived after cutover
- [x] **P0.5** Decide iframe vs inlined tab content — **iframe first** for P2; revisit inlined modules in P4

### Implementation notes

1. Create `docs/platform/` for platform-specific docs (architecture, new-tool guide, env matrix).
2. Add a short **“Platform constraints”** section to `LLM_PRODUCT_RULES.md`:
   - Tools process data in the browser only
   - No `fetch()` to NeoNema-owned APIs
   - Legal pages (`privacy-policy.html`, `terms.html`) required per tool subtree
3. Keep per-app folders (`apps/json/`, `apps/revealip/`) — the monorepo layout already matches requirement 1.

### Step verification

#### P0.1 — Single-origin deploy model

**Explanation:** All platform docs and agent instructions describe one S3 bucket and one CloudFront distribution at `tools.neonema.com`, with each tool as a path prefix (`/json/`, `/revealip/`). This is the default for all new work.

**Manual verification:**

```bash
grep -l "tools.neonema.com" docs/platform/ARCHITECTURE.md AGENTS.md
grep -A5 "Single-origin" docs/platform/ARCHITECTURE.md
```

Confirm the architecture doc shows `dist/` layout with hub at root and tool subtrees — not separate origins per tool.

---

#### P0.2 — `docs/platform/ARCHITECTURE.md`

**Explanation:** A single canonical architecture doc captures static-only rules, the RevealIP `/api/ip` edge exception, tab routing, and the current-vs-target deploy model so agents and humans share one source of truth.

**Manual verification:**

```bash
test -f docs/platform/ARCHITECTURE.md && echo "OK: architecture doc exists"
grep -E "Static-only|/api/ip|tab" docs/platform/ARCHITECTURE.md
```

Open the file and confirm it covers: single-origin layout, no-backend constraint, RevealIP CloudFront Function exception, and hub tab routes (`#/json`, `#/revealip`).

---

#### P0.3 — Update `AGENTS.md` and `LLM_PRODUCT_RULES.md`

**Explanation:** AI agents and contributors must see the hub path (`apps/hub/`), unified `dist/` deploy target, and the no-backend rule in the files they read first.

**Manual verification:**

```bash
grep -E "apps/hub|dist/|no backend|fetch\(\)" AGENTS.md LLM_PRODUCT_RULES.md
npm run brand:check
```

Both files should mention `tools.neonema.com`, `scripts/build.mjs` (or `dist/`), and prohibit NeoNema-owned API calls.

---

#### P0.4 — Canonical repo statement in README

**Explanation:** `neonema-tools` is declared the single repo for all tools; legacy per-app repos are noted as archived after cutover.

**Manual verification:**

```bash
grep -iE "canonical|neonema-tools|monorepo" README.md
```

README should list `apps/json/`, `apps/revealip/`, and point to `docs/platform/` for platform architecture.

---

#### P0.5 — iframe vs inlined tab content

**Explanation:** Tab panels load tool UIs via iframe first (faster to ship in P2); inlined modules are deferred to P4 polish.

**Manual verification:**

```bash
grep -i "iframe" docs/platform/ARCHITECTURE.md docs/TOOLS_PLATFORM_PLAN.md
```

Confirm the Open decisions table at the bottom of this doc shows **iframe first** as resolved.

---

#### P0 phase complete

**Explanation:** P0 is documentation and guardrails only — no AWS or hub code yet. Success means constraints are written, agents are aligned, and repo checks still pass.

**Manual verification:**

```bash
npm run brand:check
npm run test:json-converters
```

Both commands should exit 0. No deploy or DNS changes are expected at this stage.

---

## P1 — Production hosting for tools.neonema.com

**Covers:** requirement 3 (infrastructure), partial 8  
**Effort:** ~1–2 days  
**Depends on:** P0

### Checklist

- [ ] **P1.1** Consolidate into **NeoNema LLC** AWS account (migrate off separate RevealIP / JSON accounts) — see `docs/infra/README.md`
- [ ] **P1.2** Provision **S3** bucket `neonema-tools-prod` (private, block public access)
- [ ] **P1.3** Provision **CloudFront** distribution with OAC, HTTPS, `tools.neonema.com` alternate domain name
- [ ] **P1.4** Issue **ACM certificate** in `us-east-1` for `tools.neonema.com` (and `dev.tools.neonema.com` if doing P6 in parallel)
- [ ] **P1.5** Cloudflare DNS: `tools` CNAME → CloudFront distribution domain (see `docs/deploy/cloudflare-dns.md`)
- [ ] **P1.6** Add `scripts/build.mjs` — assembles deployable tree from `apps/hub/public`, `apps/json/public`, `apps/revealip/public` into `dist/` with correct prefixes
- [ ] **P1.7** Extend `deploy.config.example.json` with a `platform` (or `tools-hub`) entry pointing at `dist/` and the new bucket/distribution
- [ ] **P1.8** Wire RevealIP edge function on the **unified** distribution: `/api/ip` → `apps/revealip/cloudfront/ip-api-function.js` (update `docs/deploy/revealip-cloudfront-function.md` for path on shared distribution)
- [ ] **P1.9** Smoke test: `npm run build && npm run deploy -- platform --dry-run` then real deploy
- [ ] **P1.10** Verify `https://tools.neonema.com/json/` and `/revealip/` serve correct apps

### Implementation notes

**Build script sketch (`scripts/build.mjs`):**

```
dist/
  index.html              ← apps/hub/public/index.html
  hub.js, hub.css         ← apps/hub/public/*
  json/                   ← apps/json/public/*
  revealip/               ← apps/revealip/public/*
```

- Reuse existing `scripts/deploy.mjs` — add `platform` app config with `"source": "dist"`.
- Add npm scripts: `"build": "node scripts/build.mjs"`, `"deploy:prod": "npm run build && npm run deploy -- platform"`.
- RevealIP’s `/api/ip` must be configured on the **same** CloudFront distribution as the static paths (viewer-request function on `/api/ip*`).

**IaC (optional in P1, recommended before P5):** add `infra/` Terraform or CDK modules for S3 + CloudFront + OAC. Manual Console setup is acceptable for first cutover; IaC before enabling GitHub deploy reduces drift.

### Step verification

#### P1.1 — AWS account consolidation

**Explanation:** RevealIP and JSON legacy stacks move into the NeoNema LLC AWS account so one IAM model, one billing view, and one OIDC deploy role (P5) are possible.

**Manual verification:**

```bash
aws sts get-caller-identity
# Confirm Account ID matches NeoNema LLC (not legacy RevealIP/JSON accounts)
aws s3 ls | grep neonema-tools-prod
```

Follow `docs/infra/README.md` migration checklist. Legacy buckets should still exist only if cutover is not finished.

---

#### P1.2 — S3 bucket `neonema-tools-prod`

**Explanation:** Private production bucket holds the unified `dist/` tree. Block public access; CloudFront OAC is the only read path.

**Manual verification:**

```bash
aws s3api get-bucket-location --bucket neonema-tools-prod
aws s3api get-public-access-block --bucket neonema-tools-prod
```

In AWS Console → S3 → `neonema-tools-prod`: **Block all public access** = On. No bucket policy granting `Principal: "*"`.

---

#### P1.3 — CloudFront distribution (prod)

**Explanation:** HTTPS distribution with OAC to the prod bucket and `tools.neonema.com` as an alternate domain name.

**Manual verification:**

```bash
aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?@=='tools.neonema.com']].[Id,DomainName,Status]" --output table
```

Distribution status should be **Deployed**. Origin must use OAC (not legacy OAI with public bucket).

---

#### P1.4 — ACM certificate

**Explanation:** TLS cert in `us-east-1` (required for CloudFront) covering `tools.neonema.com` and optionally `dev.tools.neonema.com`.

**Manual verification:**

```bash
aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?contains(DomainName,'neonema.com')]"
aws acm describe-certificate --region us-east-1 --certificate-arn <ARN> \
  --query "Certificate.Status"
```

Status must be **ISSUED**. DNS validation records should show as verified in ACM.

---

#### P1.5 — Cloudflare DNS

**Explanation:** `tools.neonema.com` CNAME points to the CloudFront distribution domain (orange-cloud proxy per your DNS runbook).

**Manual verification:**

```bash
dig tools.neonema.com +short
dig tools.neonema.com CNAME +short
openssl s_client -connect tools.neonema.com:443 -servername tools.neonema.com </dev/null 2>/dev/null | openssl x509 -noout -subject -dates
```

`dig` should resolve to CloudFront. Browser should show valid HTTPS with no certificate mismatch.

---

#### P1.6 — `scripts/build.mjs`

**Explanation:** Build script copies hub + all tool `public/` folders into `dist/` with correct path prefixes before deploy.

**Manual verification:**

```bash
npm run build
find dist -type f | sort
test -f dist/index.html && test -d dist/json && test -d dist/revealip && echo "OK: dist layout"
```

Expected top-level layout: `dist/index.html`, `dist/json/...`, `dist/revealip/...`. `dist/` should be gitignored.

---

#### P1.7 — `deploy.config` platform entry

**Explanation:** Deploy config maps the `platform` app to `dist/` and the prod bucket + distribution ID so one command ships the full site.

**Manual verification:**

```bash
grep -A10 '"platform"' deploy.config.example.json
npm run deploy -- platform --dry-run
```

Dry-run should print `aws s3 sync dist/` (or equivalent) targeting `neonema-tools-prod` and a CloudFront invalidation for `/*` or configured paths.

---

#### P1.8 — RevealIP edge function on unified distribution

**Explanation:** `/api/ip` on the **same** CloudFront distribution as static files uses the RevealIP viewer-request function; no separate RevealIP distribution for production.

**Manual verification:**

```bash
# After deploy + function publish:
curl -sI "https://tools.neonema.com/api/ip" | head -5
curl -s "https://tools.neonema.com/api/ip"
```

Response should be JSON with a public IP field. Check CloudFront Console → Behaviors: `/api/ip*` has the function association. See `docs/deploy/revealip-cloudfront-function.md`.

---

#### P1.9 — Build + deploy smoke test

**Explanation:** Full pipeline from monorepo sources to live CDN without errors — dry-run first, then real sync + invalidation.

**Manual verification:**

```bash
npm run build
npm run deploy -- platform --dry-run
npm run deploy -- platform
```

After real deploy, wait 1–2 minutes for invalidation. Re-run curl/browser checks below.

---

#### P1.10 — Tool paths live on production

**Explanation:** Direct URLs `/json/` and `/revealip/` work for bookmarks, SEO, and legacy redirects even before the tabbed hub (P2).

**Manual verification:**

```bash
curl -sI "https://tools.neonema.com/json/" | head -3
curl -sI "https://tools.neonema.com/revealip/" | head -3
```

Browser: open both URLs — JSON Toolkit and RevealIP load, brand header visible, core tool actions work. RevealIP IP lookup succeeds via `/api/ip`.

---

#### P1 phase complete

**Explanation:** Production origin exists at `tools.neonema.com` with unified build output. Tools are reachable at path prefixes; hub may still be a minimal listing until P2.

**Manual verification:**

```bash
npm run build && npm run brand:check
curl -sI "https://tools.neonema.com/" | grep -i "HTTP/"
curl -sI "https://tools.neonema.com/json/" | grep -i "HTTP/"
curl -sI "https://tools.neonema.com/revealip/" | grep -i "HTTP/"
curl -s "https://tools.neonema.com/api/ip"
```

All HTTP responses should be `200` (or `301` only if you intentionally redirect root). IP API returns valid JSON.

---

## P2 — Tools hub with tab navigation

**Covers:** requirements 3, 5  
**Effort:** ~1–2 days  
**Depends on:** P1 (or local `npm run build` preview)

### Checklist

- [ ] **P2.1** Scaffold `apps/hub/` from `packages/utility-template/` (hub is not a “tool” but uses the same brand shell)
- [ ] **P2.2** Hub UI: tab bar listing registered tools (config-driven `tools.json` or `hub.config.json` in `apps/hub/`)
- [ ] **P2.3** Client-side router: `#/json`, `#/revealip`, default tab (e.g. JSON or a neutral landing state)
- [ ] **P2.4** Tab content: load tool via iframe `src="/json/index.html"` (adjust tool CSS so it works inside iframe height) **or** embed panel markup
- [ ] **P2.5** Hub meta: title “NeoNema Tools”, description, favicon; no AdSense on hub unless desired
- [ ] **P2.6** Register hub in `scripts/brand-check.mjs` scan list
- [ ] **P2.7** Include hub in `scripts/build.mjs` output at `dist/index.html`
- [ ] **P2.8** Document tab registration in `docs/platform/ADD_A_TOOL.md` (stub in P2, full in P4)
- [ ] **P2.9** Device test: mobile tab bar, deep link `tools.neonema.com/#/revealip`, back/forward navigation

### Implementation notes

**`apps/hub/hub.config.json` example:**

```json
{
  "defaultTool": "json",
  "tools": [
    { "id": "json", "label": "JSON Toolkit", "path": "/json/index.html", "description": "Validate, format, convert JSON" },
    { "id": "revealip", "label": "RevealIP", "path": "/revealip/index.html", "description": "Show your public IP" }
  ]
}
```

- Tabs switch `location.hash` or `history.pushState`; iframe `src` updates accordingly.
- Keep each tool’s `index.html` self-contained so `/json/` still works as a direct URL (SEO, bookmarks, legacy redirects).

### Step verification

#### P2.1 — Scaffold `apps/hub/`

**Explanation:** The hub shell lives at `apps/hub/` with the same NeoNema brand assets as tools (copied from `packages/brand/`, not symlinked).

**Manual verification:**

```bash
test -d apps/hub/public && test -f apps/hub/public/index.html && echo "OK: hub exists"
ls apps/hub/public/brand-tokens.css apps/hub/public/NeoNema.png 2>/dev/null
npm run brand:check
```

`brand:check` should include `apps/hub/public/` in its scan list with no failures.

---

#### P2.2 — Config-driven tab bar

**Explanation:** Tool list comes from `hub.config.json` (or `tools.json`) so adding a tool does not require editing HTML for every tab label.

**Manual verification:**

```bash
test -f apps/hub/hub.config.json && cat apps/hub/hub.config.json
grep -E '"json"|"revealip"' apps/hub/hub.config.json
```

Open `https://tools.neonema.com/` (or local preview) — tab bar shows **JSON Toolkit** and **RevealIP** labels matching config.

---

#### P2.3 — Client-side router

**Explanation:** Hash or `history` routes (`#/json`, `#/revealip`) switch tabs without full page reload; URL is shareable.

**Manual verification:**

```bash
# Local preview (after build):
npm run build
python3 -m http.server 8765 --directory dist
```

Browser (http://localhost:8765/):

1. Click **RevealIP** tab — URL becomes `#/revealip` (or `/revealip` if using `pushState`).
2. Paste `http://localhost:8765/#/json` in a new tab — JSON tab is active on load.
3. Use browser Back/Forward — tab state follows history.

---

#### P2.4 — Tab content (iframe)

**Explanation:** Each tab loads the tool via iframe `src="/json/index.html"` etc. Tool CSS should not break inside the iframe viewport.

**Manual verification:**

Browser on hub:

1. JSON tab — formatter/validator UI is usable; scroll if needed.
2. RevealIP tab — IP displays; no double scrollbars or clipped header.
3. DevTools → Network: iframe requests hit `/json/index.html` and `/revealip/index.html` (same origin).

Resize to mobile width (375px) — both tools remain usable inside the panel.

---

#### P2.5 — Hub meta

**Explanation:** Root page has correct title, description, and favicon for the tools hub (not a single-tool title).

**Manual verification:**

```bash
grep -E "<title>|meta name=\"description\"" apps/hub/public/index.html
curl -s "https://tools.neonema.com/" | grep -i "<title>"
curl -sI "https://tools.neonema.com/favicon.ico" | head -3
```

Title should reference **NeoNema Tools** (or similar hub branding). Favicon returns `200`.

---

#### P2.6 — Hub in `brand-check.mjs`

**Explanation:** Hub is subject to the same brand parity checks as tool apps.

**Manual verification:**

```bash
grep -E "hub|apps/\*" scripts/brand-check.mjs
npm run brand:check
```

Intentionally break a brand file in `apps/hub/public/` — `brand:check` should fail; revert before committing.

---

#### P2.7 — Hub in `scripts/build.mjs`

**Explanation:** Build output places hub at `dist/index.html` (site root), not a subdirectory.

**Manual verification:**

```bash
npm run build
test -f dist/index.html && grep -q "hub" dist/index.html 2>/dev/null || head -5 dist/index.html
diff -q apps/hub/public/index.html dist/index.html 2>/dev/null || echo "Check build copies hub to root"
```

Deploy and confirm `https://tools.neonema.com/` serves the tabbed hub, not a stale placeholder.

---

#### P2.8 — Tab registration doc stub

**Explanation:** `docs/platform/ADD_A_TOOL.md` documents how to register a new tool in hub config and build script (full guide completed in P4).

**Manual verification:**

```bash
test -f docs/platform/ADD_A_TOOL.md && grep -iE "hub.config|tab|register" docs/platform/ADD_A_TOOL.md
```

Doc should mention editing `hub.config.json` and `scripts/build.mjs` app list.

---

#### P2.9 — Device and navigation test

**Explanation:** Hub works on mobile, deep links land on the correct tab, and history navigation is predictable.

**Manual verification:**

Production (or staging):

1. `https://tools.neonema.com/#/revealip` — RevealIP tab active, tool works.
2. `https://tools.neonema.com/#/json` — JSON tab active.
3. Phone or DevTools device mode — tab bar wraps or scrolls; no horizontal overflow on body.
4. Back button after switching tabs returns to previous tab state.

Use `docs/deploy/device-test-checklist.md` for a fuller pass if desired.

---

#### P2 phase complete

**Explanation:** `tools.neonema.com` root is the tabbed hub; tools work both inside tabs and at direct `/json/` and `/revealip/` URLs.

**Manual verification:**

```bash
npm run build && npm run brand:check
```

Browser checklist:

- [ ] Root hub loads with tabs
- [ ] `#/json` and `#/revealip` deep links work
- [ ] Direct `/json/` and `/revealip/` still work
- [ ] Mobile layout acceptable

---

## P3 — Legacy domain redirects

**Covers:** requirement 4  
**Effort:** ~0.5–1 day  
**Depends on:** P1 (production URL live), P2 (hash routes stable)

### Checklist

- [ ] **P3.1** Define canonical targets:
  - `https://neonema-revealip.com` → `https://tools.neonema.com/#/revealip`
  - `https://neonema-json.com` → `https://tools.neonema.com/#/json`
  - Include `www` variants
- [ ] **P3.2** Implement redirects in **Cloudflare** (recommended): Bulk Redirects or Page Rules — 301, preserve path only if needed (usually redirect apex → hub hash)
- [ ] **P3.3** Alternative: dedicated minimal CloudFront distributions per legacy domain with CloudFront Function redirect (if DNS cannot move to Cloudflare)
- [ ] **P3.4** Update each tool’s `robots.txt` / canonical tags if they reference old domains
- [ ] **P3.5** Verify with `curl -I` and browser from cold cache
- [ ] **P3.6** Run AdSense / Search Console domain updates if properties are tied to old hostnames
- [ ] **P3.7** Document in `docs/platform/DOMAIN_CUTOVER.md`
- [ ] **P3.8** After 30-day soak: decommission old S3 buckets and CloudFront distributions (separate AWS accounts)

### Implementation notes

**Cloudflare Bulk Redirect (example):**

| Source | Target | Status |
|--------|--------|--------|
| `neonema-json.com/*` | `https://tools.neonema.com/#/json` | 301 |
| `neonema-revealip.com/*` | `https://tools.neonema.com/#/revealip` | 301 |

If a tool relied on apex `index.html` at the old domain, apex redirect is sufficient; no path mapping required.

### Step verification

#### P3.1 — Canonical redirect targets

**Explanation:** Every legacy hostname has a documented 301 target on `tools.neonema.com` with the correct hub hash so users land on the right tab.

**Manual verification:**

```bash
grep -E "neonema-revealip|neonema-json|#/revealip|#/json" docs/TOOLS_PLATFORM_PLAN.md docs/platform/DOMAIN_CUTOVER.md 2>/dev/null
```

Confirm written targets:

| Source | Target |
|--------|--------|
| `neonema-json.com` (+ `www`) | `https://tools.neonema.com/#/json` |
| `neonema-revealip.com` (+ `www`) | `https://tools.neonema.com/#/revealip` |

---

#### P3.2 — Cloudflare redirects

**Explanation:** 301 redirects at the edge send all legacy traffic to the unified hub without hitting old S3/CloudFront stacks.

**Manual verification:**

```bash
curl -sI "https://neonema-json.com/" | grep -iE "HTTP/|location:"
curl -sI "https://www.neonema-json.com/" | grep -iE "HTTP/|location:"
curl -sI "https://neonema-revealip.com/" | grep -iE "HTTP/|location:"
curl -sI "https://www.neonema-revealip.com/" | grep -iE "HTTP/|location:"
```

Each response: `HTTP/2 301` (or `308`) and `location: https://tools.neonema.com/#/...` matching the tool.

---

#### P3.3 — Alternative CloudFront redirect (if used)

**Explanation:** If legacy DNS cannot use Cloudflare Bulk Redirects, minimal per-domain CloudFront distributions with a redirect function are an acceptable fallback.

**Manual verification:**

```bash
# Only if P3.3 path was chosen:
curl -sI "https://neonema-json.com/" | grep -i location
aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?@=='neonema-json.com']].Id"
```

Skip this block if P3.2 Cloudflare redirects are in place and working.

---

#### P3.4 — `robots.txt` / canonical tags

**Explanation:** Tool HTML no longer advertises legacy domains as canonical; search engines consolidate on `tools.neonema.com`.

**Manual verification:**

```bash
grep -rE "canonical|neonema-json\.com|neonema-revealip\.com" apps/json/public apps/revealip/public
curl -s "https://tools.neonema.com/json/" | grep -i canonical
curl -s "https://tools.neonema.com/revealip/" | grep -i canonical
```

Canonical URLs should use `https://tools.neonema.com/...`, not legacy hostnames.

---

#### P3.5 — Cold-cache redirect test

**Explanation:** Redirects work from a fresh client (no cached 200 from old origin).

**Manual verification:**

```bash
curl -sI "https://neonema-json.com/" -H "Cache-Control: no-cache" | grep -iE "HTTP/|location:"
```

Browser (incognito / private window):

1. Open `https://neonema-json.com` — lands on JSON tab at `tools.neonema.com`.
2. Open `https://neonema-revealip.com` — lands on RevealIP tab.
3. Bookmarked old URLs still redirect.

---

#### P3.6 — AdSense / Search Console

**Explanation:** Ad and search properties reflect the new canonical host so revenue and indexing follow the migration.

**Manual verification:**

Manual (no CLI):

1. Google Search Console — add or verify `tools.neonema.com` property; submit updated sitemap if used.
2. AdSense — site list includes `tools.neonema.com` paths; remove or demote legacy domains after soak period.
3. Confirm no ad serving errors on `/json/` and `/revealip/` after domain change.

---

#### P3.7 — `docs/platform/DOMAIN_CUTOVER.md`

**Explanation:** Runbook documents redirect rules, verification commands, and decommission timeline for future you.

**Manual verification:**

```bash
test -f docs/platform/DOMAIN_CUTOVER.md && echo "OK"
grep -iE "301|cloudflare|decommission" docs/platform/DOMAIN_CUTOVER.md
```

---

#### P3.8 — Decommission old AWS stacks (post-soak)

**Explanation:** After ~30 days of stable redirects, legacy per-app S3 buckets and CloudFront distributions in old accounts can be deleted to stop billing and confusion.

**Manual verification:**

```bash
# Legacy accounts — should be empty or disabled after cutover:
aws s3 ls  # (with legacy profile if still needed)
```

Checklist before delete:

- [ ] 30+ days without redirect failures in monitoring or support tickets
- [ ] `curl` tests still pass for legacy domains
- [ ] No DNS A/AAAA records pointing at old CloudFront IDs
- [ ] Final backup of old buckets if required, then delete distribution → bucket order

---

#### P3 phase complete

**Explanation:** Legacy domains only redirect; all user traffic intended for JSON/RevealIP reaches the unified hub.

**Manual verification:**

```bash
for host in neonema-json.com www.neonema-json.com neonema-revealip.com www.neonema-revealip.com; do
  echo "=== $host ==="
  curl -sI "https://$host/" | grep -iE "HTTP/|location:"
done
```

Incognito browser: both apex domains open the correct tab on `tools.neonema.com` and tools function.

---

## P4 — Tools platform velocity (templates & automation)

**Covers:** requirement 7  
**Effort:** ~2–3 days  
**Depends on:** P0, P1, P2 (patterns proven once)

### Checklist

- [ ] **P4.1** `scripts/scaffold-tool.mjs` — copies `packages/utility-template/` → `apps/<name>/`, runs `sync-brand`, patches placeholders
- [ ] **P4.2** `npm run scaffold -- <tool-id> "<Tool Label>"` npm script
- [ ] **P4.3** Auto-append new tool to `apps/hub/hub.config.json` and `scripts/build.mjs` app list
- [ ] **P4.4** `docs/platform/ADD_A_TOOL.md` — end-to-end checklist (scaffold → implement → brand:check → build → deploy)
- [ ] **P4.5** `docs/platform/TOOL_CHECKLIST.md` — pre-ship: legal pages, ads.txt, robots.txt, device test, accessibility smoke
- [ ] **P4.6** Optional per-tool `apps/<name>/tool.meta.json` (id, label, description, icon) consumed by hub and build
- [ ] **P4.7** Extend CI: `brand:check` already scans apps; add build dry-run on PR
- [ ] **P4.8** Cookie-cutter GitHub PR template for new tools

### Implementation notes

**Target time-to-ship for a simple tool:**

1. `npm run scaffold -- slugify "Slugify Text"` (~1 min)
2. Implement `app.js` + copy (~1–4 hrs)
3. `npm run brand:check && npm run test` (~1 min)
4. Merge to `main` → auto deploy (after P5)

Keep `packages/utility-template/` as the only scaffold source; never fork manually.

### Step verification

#### P4.1 — `scripts/scaffold-tool.mjs`

**Explanation:** One script creates a new `apps/<name>/` tree from `utility-template`, runs brand sync, and replaces placeholders.

**Manual verification:**

```bash
test -f scripts/scaffold-tool.mjs && echo "OK"
node scripts/scaffold-tool.mjs --help 2>/dev/null || head -20 scripts/scaffold-tool.mjs
```

Dry run on a throwaway name in a git branch:

```bash
npm run scaffold -- test-tool "Test Tool"
test -d apps/test-tool/public && npm run brand:check
git checkout -- . && git clean -fd apps/test-tool  # discard test scaffold
```

---

#### P4.2 — `npm run scaffold` script

**Explanation:** Package.json exposes scaffold as a documented one-liner for contributors.

**Manual verification:**

```bash
grep "scaffold" package.json
npm run scaffold -- 2>&1 | head -5
```

Without args, should print usage or error with expected `<tool-id> "<Tool Label>"` format.

---

#### P4.3 — Auto-append hub + build registration

**Explanation:** Scaffolding a tool updates `hub.config.json` and the `scripts/build.mjs` app list so the new tool is included in `dist/` and hub tabs automatically.

**Manual verification:**

After scaffold (on a test branch):

```bash
grep "test-tool" apps/hub/hub.config.json scripts/build.mjs
npm run build && test -d dist/test-tool && echo "OK: built into dist"
```

Revert test scaffold when done.

---

#### P4.4 — `docs/platform/ADD_A_TOOL.md`

**Explanation:** End-to-end guide: scaffold → implement `app.js` → `brand:check` → `build` → deploy.

**Manual verification:**

```bash
test -f docs/platform/ADD_A_TOOL.md
grep -iE "scaffold|brand:check|build|deploy" docs/platform/ADD_A_TOOL.md
```

Walk through the doc mentally — every step should map to an npm script that exists in `package.json`.

---

#### P4.5 — `docs/platform/TOOL_CHECKLIST.md`

**Explanation:** Pre-ship checklist covers legal pages, `ads.txt`, `robots.txt`, device test, and accessibility smoke.

**Manual verification:**

```bash
test -f docs/platform/TOOL_CHECKLIST.md
grep -iE "privacy|terms|ads\.txt|robots" docs/platform/TOOL_CHECKLIST.md
```

Cross-check against an existing app:

```bash
ls apps/json/public/privacy-policy.html apps/json/public/terms.html apps/json/public/ads.txt
```

---

#### P4.6 — Optional `tool.meta.json`

**Explanation:** Per-tool metadata file can drive hub labels and build registration from one source.

**Manual verification:**

```bash
# If implemented:
ls apps/*/tool.meta.json 2>/dev/null
grep -r "tool.meta.json" scripts/ apps/hub/
```

Scaffold should create `tool.meta.json`; hub or build script should read `label` and `description` from it.

---

#### P4.7 — CI build dry-run on PR

**Explanation:** Pull requests run `npm run build` (or equivalent) so broken hub/build integration is caught before merge.

**Manual verification:**

```bash
grep -E "build|brand:check" .github/workflows/ci.yml
npm run build
```

Open a test PR that breaks `build.mjs` — CI should fail. Restore and confirm green check.

---

#### P4.8 — PR template for new tools

**Explanation:** GitHub PR template reminds authors of legal pages, brand check, and device test.

**Manual verification:**

```bash
test -f .github/pull_request_template.md && grep -iE "tool|brand|legal" .github/pull_request_template.md
```

Or confirm template path in repo settings via:

```bash
gh api repos/:owner/:repo/contents/.github --jq '.[].name' 2>/dev/null
```

---

#### P4 phase complete

**Explanation:** A new tool can go from scaffold to deployable `dist/` subtree in minutes; docs and CI enforce the checklist.

**Manual verification:**

Timed dry run (use a throwaway tool id on a branch):

```bash
npm run scaffold -- slugify "Slugify Text"
# implement minimal app.js change
npm run brand:check && npm run test:json-converters && npm run build
ls dist/slugify/
```

Target: scaffold + checks + build in under 15 minutes excluding feature implementation.

---

## P5 — GitHub Actions → AWS deploy

**Covers:** requirement 8  
**Effort:** ~1–2 days  
**Depends on:** P1 (prod infra), P4 (build script stable)

### Checklist

- [ ] **P5.1** Create IAM OIDC identity provider for GitHub in NeoNema LLC account
- [ ] **P5.2** IAM role `github-neonema-tools-deploy` — trust policy scoped to `repo:<org>/neonema-tools`, branch `main`
- [ ] **P5.3** Role permissions: `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject` on prod bucket; `cloudfront:CreateInvalidation`; RevealIP function publish if edge changes
- [ ] **P5.4** `.github/workflows/deploy-prod.yml` — on push to `main`: checkout → `npm run brand:check` → `npm run test:json-converters` → `npm run build` → `aws s3 sync` → invalidation
- [ ] **P5.5** Use `aws-actions/configure-aws-credentials@v4` with `role-to-assume` (no long-lived keys in secrets)
- [ ] **P5.6** Store non-secret config in repo: `deploy.config.prod.json` (bucket name, distribution ID, region) — **no** profiles; OIDC role replaces profiles
- [ ] **P5.7** Manual `workflow_dispatch` for on-demand deploy
- [ ] **P5.8** Update `docs/deploy/automated-deploy.md` with CI path; mark local deploy as fallback
- [ ] **P5.9** Optional: deploy only changed app prefixes (path-filter) to speed up CI

### Implementation notes

Split config by environment:

| File | In git? | Contents |
|------|---------|----------|
| `deploy.config.prod.json` | Yes | bucket, distribution ID, region, invalidate paths |
| `deploy.config.local.json` | No (gitignored) | overrides + `awsProfile` for local dev |
| `deploy.config.dev.json` | Yes | dev bucket + distribution (P6) |

Workflow skeleton:

```yaml
on:
  push:
    branches: [main]
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm run brand:check
      - run: npm run test:json-converters
      - run: npm run build
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/github-neonema-tools-deploy
          aws-region: us-east-1
      - run: npm run deploy -- platform --config deploy.config.prod.json
```

### Step verification

#### P5.1 — GitHub OIDC identity provider

**Explanation:** AWS trusts GitHub Actions via OIDC so workflows assume a role without long-lived access keys in secrets.

**Manual verification:**

```bash
aws iam list-open-id-connect-providers
aws iam get-open-id-connect-provider --open-id-connect-provider-arn <ARN>
```

Provider URL should be `token.actions.githubusercontent.com`. Thumbprint matches GitHub’s current OIDC cert.

---

#### P5.2 — IAM deploy role

**Explanation:** Role `github-neonema-tools-deploy` trusts only your org’s `neonema-tools` repo and `main` branch (adjust if using environment protection).

**Manual verification:**

```bash
aws iam get-role --role-name github-neonema-tools-deploy --query "Role.AssumeRolePolicyDocument"
```

Trust policy `sub` claim should include `repo:<org>/neonema-tools:ref:refs/heads/main` (or `environment:production` if using GH environments).

---

#### P5.3 — Role permissions

**Explanation:** Role can sync to prod bucket, invalidate CloudFront, and publish RevealIP edge function when needed — nothing broader.

**Manual verification:**

```bash
aws iam list-role-policies --role-name github-neonema-tools-deploy
aws iam list-attached-role-policies --role-name github-neonema-tools-deploy
```

Inline or managed policy should allow only:

- `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::neonema-tools-prod` and `arn:aws:s3:::neonema-tools-prod/*`
- `cloudfront:CreateInvalidation` on the prod distribution ARN
- `cloudfront:DescribeFunction`, `cloudfront:PublishFunction`, `cloudfront:UpdateFunction` if edge deploy is in CI

---

#### P5.4 — `deploy-prod.yml` workflow

**Explanation:** Push to `main` runs brand check, tests, build, S3 sync, and invalidation in CI.

**Manual verification:**

```bash
test -f .github/workflows/deploy-prod.yml
grep -E "brand:check|test:json|build|deploy" .github/workflows/deploy-prod.yml
```

Push an empty commit to `main` (or merge a PR) and watch Actions:

```bash
gh run list --workflow=deploy-prod.yml --limit 3
gh run watch
```

---

#### P5.5 — `configure-aws-credentials` with OIDC

**Explanation:** Workflow uses `id-token: write` and `role-to-assume` — no `AWS_ACCESS_KEY_ID` in GitHub secrets.

**Manual verification:**

```bash
grep -A5 "configure-aws-credentials" .github/workflows/deploy-prod.yml
grep "id-token: write" .github/workflows/deploy-prod.yml
```

Workflow log step “Configure AWS credentials” should show **Assuming role** with the deploy role ARN, not static key mask.

---

#### P5.6 — `deploy.config.prod.json` in repo

**Explanation:** Non-secret deploy targets (bucket, distribution ID, region) live in git; OIDC replaces AWS profiles.

**Manual verification:**

```bash
test -f deploy.config.prod.json
grep -E "bucket|distribution|region" deploy.config.prod.json
! grep -i "secret\|access_key\|profile" deploy.config.prod.json
```

File should be valid JSON and match actual prod resource names.

---

#### P5.7 — `workflow_dispatch`

**Explanation:** Manual “Run workflow” button redeploys production without an empty commit.

**Manual verification:**

```bash
grep "workflow_dispatch" .github/workflows/deploy-prod.yml
gh workflow run deploy-prod.yml
gh run list --workflow=deploy-prod.yml --limit 1
```

GitHub → Actions → Deploy prod → **Run workflow** should start a successful run.

---

#### P5.8 — Update `automated-deploy.md`

**Explanation:** Docs describe CI as primary deploy path; local `npm run deploy` is documented fallback.

**Manual verification:**

```bash
grep -iE "github actions|OIDC|workflow" docs/deploy/automated-deploy.md
grep -iE "fallback|local" docs/deploy/automated-deploy.md
```

---

#### P5.9 — Optional path-filter deploy

**Explanation:** CI deploys only changed app prefixes to shorten run time (optional optimization).

**Manual verification:**

```bash
grep -E "paths:|path-filter|dorny" .github/workflows/deploy-prod.yml
```

If implemented: change only `apps/json/` in a PR, merge, and confirm workflow log shows scoped sync (e.g. `s3 sync dist/json/` only).

---

#### P5 phase complete

**Explanation:** Merging to `main` deploys production without local AWS credentials. Site updates within invalidation window.

**Manual verification:**

1. Note a visible string in `apps/hub/public/index.html` (or a tool), merge to `main`.
2. `gh run list --workflow=deploy-prod.yml --limit 1` — status **success**.
3. After ~2 min: `curl -s "https://tools.neonema.com/" | grep "<your string>"`
4. Confirm you did **not** run local `npm run deploy` for that change.

---

## P6 — Dev / staging environment

**Covers:** requirement 9  
**Effort:** ~1 day  
**Depends on:** P1 (same patterns), P5 (reuse workflow with different config)

### Checklist

- [ ] **P6.1** S3 bucket `neonema-tools-dev` + CloudFront `dev.tools.neonema.com`
- [ ] **P6.2** `deploy.config.dev.json` in repo (dev bucket + distribution ID)
- [ ] **P6.3** `.github/workflows/deploy-dev.yml` — deploy on push to `dev` branch **or** `workflow_dispatch` from PR branches (choose one)
- [ ] **P6.4** Optional: robots `noindex` on dev (`apps/hub/public/robots.txt` variant or build flag)
- [ ] **P6.5** Document dev URL in README and `docs/platform/ENVIRONMENTS.md`
- [ ] **P6.6** Placeholder hub banner: “Development — not production” (build-time flag `DEPLOY_ENV=dev`)

### Implementation notes

Minimal viable dev setup:

- **Branch `dev`** → auto-deploy to `dev.tools.neonema.com`
- **`main`** → production only
- PR previews can be a later enhancement (per-PR prefixes are higher effort)

### Step verification

#### P6.1 — Dev S3 + CloudFront

**Explanation:** Separate `neonema-tools-dev` bucket and distribution serve `dev.tools.neonema.com` without touching production.

**Manual verification:**

```bash
aws s3api get-bucket-location --bucket neonema-tools-dev
aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?@=='dev.tools.neonema.com']].[Id,Status]" --output table
curl -sI "https://dev.tools.neonema.com/" | head -5
```

HTTPS should succeed. Content may differ from prod (see P6.6 banner).

---

#### P6.2 — `deploy.config.dev.json`

**Explanation:** Committed config points deploy script at dev bucket and distribution ID.

**Manual verification:**

```bash
test -f deploy.config.dev.json
node -e "console.log(JSON.parse(require('fs').readFileSync('deploy.config.dev.json')))"
npm run deploy -- platform --config deploy.config.dev.json --dry-run
```

Dry-run must target `neonema-tools-dev`, not prod bucket name.

---

#### P6.3 — `deploy-dev.yml` workflow

**Explanation:** Pushes to `dev` branch (or manual dispatch) deploy staging automatically.

**Manual verification:**

```bash
test -f .github/workflows/deploy-dev.yml
grep -E "dev|workflow_dispatch|deploy.config.dev" .github/workflows/deploy-dev.yml
```

```bash
git push origin main:dev   # or merge to dev branch
gh run list --workflow=deploy-dev.yml --limit 3
```

After success: `curl -sI "https://dev.tools.neonema.com/json/" | head -3`

---

#### P6.4 — `noindex` on dev

**Explanation:** Staging should not be indexed by search engines.

**Manual verification:**

```bash
npm run build   # with DEPLOY_ENV=dev if build flag exists
grep -i noindex dist/robots.txt apps/hub/public/robots.txt 2>/dev/null
curl -s "https://dev.tools.neonema.com/robots.txt"
```

`robots.txt` on dev should contain `Disallow: /` or pages should include `<meta name="robots" content="noindex">`.

---

#### P6.5 — Document dev URL

**Explanation:** README and env doc tell contributors where to preview before merging to `main`.

**Manual verification:**

```bash
grep -i "dev.tools.neonema.com" README.md docs/platform/ENVIRONMENTS.md
test -f docs/platform/ENVIRONMENTS.md && grep -i "staging\|dev" docs/platform/ENVIRONMENTS.md
```

---

#### P6.6 — Dev banner

**Explanation:** Visible “Development — not production” banner avoids confusing testers or users who land on staging.

**Manual verification:**

```bash
curl -s "https://dev.tools.neonema.com/" | grep -i "development\|not production"
```

Browser: dev site shows banner; `https://tools.neonema.com/` does **not** show the same banner.

---

#### P6 phase complete

**Explanation:** Staging mirrors prod deploy pipeline on a separate origin; safe to break things without affecting users.

**Manual verification:**

```bash
# Prod vs dev should differ only by env banner/config, not broken tools:
diff <(curl -sI "https://tools.neonema.com/json/" | head -1) \
     <(curl -sI "https://dev.tools.neonema.com/json/" | head -1)
npm run deploy -- platform --config deploy.config.dev.json --dry-run
```

Checklist:

- [ ] `dev.tools.neonema.com` loads hub + tools
- [ ] Dev deploy workflow green on last `dev` branch push
- [ ] `robots.txt` or meta prevents indexing
- [ ] Dev banner visible on staging only

---

## P7 — neonema.com company site link

**Covers:** requirement 6  
**Effort:** ~0.5 day (mostly outside this repo)  
**Depends on:** P1 (stable production URL)

### Checklist

- [ ] **P7.1** Add prominent “Tools” link on neonema.com → `https://tools.neonema.com`
- [ ] **P7.2** Optional: short blurb on company homepage listing flagship tools
- [ ] **P7.3** Do **not** host tools on neonema.com apex (keeps concerns separated)
- [ ] **P7.4** Cross-link: tools hub footer “About NeoNema” → `https://neonema.com`

### Implementation notes

This repo can include `docs/platform/COMPANY_SITE_LINK.md` with copy-paste HTML for the neonema.com maintainer. No code change required in `neonema-tools` beyond hub footer link.

### Step verification

#### P7.1 — “Tools” link on neonema.com

**Explanation:** Company site navigation prominently links to the tools hub so visitors discover utilities from the corporate homepage.

**Manual verification:**

```bash
curl -s "https://neonema.com/" | grep -i "tools.neonema.com"
```

Browser: open https://neonema.com — header or main nav includes **Tools** (or equivalent) pointing to `https://tools.neonema.com`. Link opens correct site in same or new tab per design.

---

#### P7.2 — Optional homepage blurb

**Explanation:** Short copy on neonema.com can highlight flagship tools (JSON, RevealIP) for discovery.

**Manual verification:**

Manual browser check on https://neonema.com — optional section mentions tools and links to hub or individual tool hashes.

---

#### P7.3 — No tools on neonema.com apex

**Explanation:** Corporate site stays marketing-only; utilities remain on `tools.neonema.com` for deploy and scope separation.

**Manual verification:**

```bash
curl -s "https://neonema.com/" | grep -iE "json toolkit|revealip|app\.js" || echo "OK: no embedded tool apps on apex"
```

No iframe or script serving tool logic from neonema.com root.

---

#### P7.4 — Hub footer → neonema.com

**Explanation:** Tools hub footer links back to the company site for brand continuity.

**Manual verification:**

```bash
grep -i "neonema.com" apps/hub/public/index.html
curl -s "https://tools.neonema.com/" | grep -o 'href="[^"]*neonema.com[^"]*"'
```

Browser: footer **About NeoNema** (or similar) opens https://neonema.com.

---

#### P7 phase complete

**Explanation:** Bidirectional navigation connects company marketing and the tools platform without merging hosting.

**Manual verification:**

Manual round-trip:

1. Start at https://neonema.com → click Tools → arrive at `tools.neonema.com`.
2. Footer link → return to https://neonema.com.
3. Confirm both sites use consistent NeoNema branding (logo/colors roughly aligned).

---

## Master checklist (rollup)

Use this as the execution tracker. Details for each item are in the priority sections above.

### P0 — Decisions
- [x] P0.1 Single-origin model adopted
- [x] P0.2 `docs/platform/ARCHITECTURE.md`
- [x] P0.3 Update `AGENTS.md` + `LLM_PRODUCT_RULES.md`
- [x] P0.4 README canonical repo statement
- [x] P0.5 Tab embedding strategy chosen (iframe first)

### P1 — Production infra
- [ ] P1.1 AWS account consolidation
- [ ] P1.2–P1.5 S3 + CloudFront + ACM + DNS for tools.neonema.com
- [ ] P1.6 `scripts/build.mjs`
- [ ] P1.7–P1.10 Deploy config + RevealIP edge on unified distribution + smoke test

### P2 — Hub & tabs
- [ ] P2.1–P2.9 `apps/hub/` with config-driven tabs and build integration

### P3 — Legacy redirects
- [ ] P3.1–P3.8 Cloudflare redirects + decommission old stacks

### P4 — Platform velocity
- [ ] P4.1–P4.8 Scaffold script + ADD_A_TOOL + TOOL_CHECKLIST docs

### P5 — GitHub deploy
- [ ] P5.1–P5.9 OIDC + `deploy-prod.yml`

### P6 — Dev environment
- [ ] P6.1–P6.6 dev.tools.neonema.com + deploy-dev workflow

### P7 — Company site
- [ ] P7.1–P7.4 Links between neonema.com and tools.neonema.com

---

## Suggested execution order (sprints)

| Sprint | Focus | Deliverable |
|--------|-------|-------------|
| **Sprint 1** | P0 + P1 | `tools.neonema.com` serves `/json/` and `/revealip/` from unified build (hub can be a simple index listing tools) |
| **Sprint 2** | P2 + P3 | Tabbed hub live; legacy domains redirect |
| **Sprint 3** | P4 + P5 | Scaffold script; merge to `main` deploys prod |
| **Sprint 4** | P6 + P7 | Dev URL; company site cross-links |

---

## Repo changes preview (not yet implemented)

New paths this plan will add over time:

```
apps/hub/                          # tools.neonema.com shell + tabs
scripts/build.mjs                  # assemble dist/ for deploy
scripts/scaffold-tool.mjs          # new tool generator
dist/                              # build output (gitignored)
deploy.config.prod.json            # CI-safe prod config
deploy.config.dev.json             # dev config
.github/workflows/deploy-prod.yml
.github/workflows/deploy-dev.yml
docs/platform/
  ARCHITECTURE.md
  ADD_A_TOOL.md
  TOOL_CHECKLIST.md
  DOMAIN_CUTOVER.md
  ENVIRONMENTS.md
infra/                             # optional Terraform/CDK (P1/P5)
```

---

## Open decisions (resolve in P0)

| Decision | Options | **Resolved** |
|----------|---------|--------------|
| Tab content loading | iframe vs inlined HTML/JS | **iframe first** (P0.5); inlined later for polish |
| Dev deploy trigger | `dev` branch vs manual dispatch | `dev` branch auto-deploy + manual dispatch for hotfixes |
| IaC timing | Manual AWS Console vs Terraform now | Console for Sprint 1; Terraform before P5 |
| Default hub tab | Landing page vs first tool | Small landing with tool cards; default hash `#/json` or no default |
| AdSense | Per-tool only vs hub too | Per-tool subtrees only (current pattern) |

---

## Related docs

- [platform/ARCHITECTURE.md](./platform/ARCHITECTURE.md) — canonical platform model (P0)
- [deploy/README.md](./deploy/README.md) — current S3 + CloudFront runbooks
- [deploy/automated-deploy.md](./deploy/automated-deploy.md) — local deploy scripts (Phase 3)
- [infra/README.md](./infra/README.md) — AWS account consolidation placeholder
- [PHASE_1_CHECKLIST.md](./PHASE_1_CHECKLIST.md) — monorepo migration (complete)
- [PHASE_3_CHECKLIST.md](./PHASE_3_CHECKLIST.md) — local deploy automation (complete)

---

## Next step

**P0 complete.** Start **P1** — provision `neonema-tools-prod` S3 + CloudFront for `tools.neonema.com`, then **P1.6** (`scripts/build.mjs`) so you can deploy a unified `dist/` tree before building the tab UI in P2.
