# NeoNema Tools Platform — Plan & Checklist

Strategic plan for turning `neonema-tools` into the single source of truth for all NeoNema utility products, served from **tools.neonema.com** with fast, repeatable deploys.

**Status:** In progress (P0–P2 complete)  
**Last updated:** 2026-06-25

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
| 7 | Fast deploy platform | Templates, docs, and runbooks so agents/contributors ship a new tool in hours, not days |
| 8 | GitHub → AWS | Push/merge to `main` deploys production from GitHub Actions |
| 9 | Dev environment | A separate dev/staging URL for pre-production validation |

---

## Recommended architecture

### Hosting model (single origin)

Use **one S3 bucket + one CloudFront distribution** for `tools.neonema.com`. Each tool is a static subtree; the hub is the site root.

```
tools.neonema.com/              → apps/hub/public/          (tab shell + tool picker)
tools.neonema.com/#/json        → JSON Toolkit (hub tab — public entry)
tools.neonema.com/#/revealip    → RevealIP (hub tab — public entry)
tools.neonema.com/json/...      → apps/json/public/         (iframe assets; redirects if opened directly)
tools.neonema.com/revealip/...  → apps/revealip/public/     (iframe assets; redirects if opened directly)
```

**Build step:** a deploy script assembles `dist/` (or syncs prefixes) from each app before `aws s3 sync`.

**Why one origin:** one ACM cert, one invalidation target, one GitHub deploy workflow, simpler DNS. Tools remain independent folders in the monorepo.

### Tab model

The hub (`apps/hub/`) is a lightweight static shell:

- Fixed NeoNema header (shared brand lock)
- Horizontal tab bar: JSON · RevealIP · (future tools)
- Clicking a tab shows that tool’s panel **without a full page reload** (hash routes like `#/json`, `#/revealip`)
- Deep links: `tools.neonema.com/#/json` and legacy redirects land on the correct tab
- Each tool panel loads via **iframe** (`src="/json/index.html"`, etc.) — see P0.5
- **No public direct tool URLs:** `/json/` and `/revealip/` redirect to hub hash routes (CloudFront + tool `index.html` guard)

**Registering a new tool is explicit, not automatic.** When adding a tool, an agent or contributor edits `apps/hub/hub.config.json` and `scripts/build.mjs` per `docs/platform/ADD_A_TOOL.md`. The hub does not scan `apps/` or auto-append tabs.

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
| `neonema.com` | Company marketing site | Separate repo/project; **separate AWS account**; add “Tools” nav link |

### AWS layout (target)

**Two AWS accounts** — tools and company site — with Cloudflare DNS routing each hostname to the correct CloudFront distribution. This repo deploys only to the **NeoNema tools account**.

| Account | Hostnames | Repo |
|---------|-----------|------|
| **NeoNema tools** | `tools.neonema.com`, `dev.tools.neonema.com` | `neonema-tools` (this repo) |
| **NeoNema company** | `neonema.com` | Separate company-site repo |

```
NeoNema tools AWS account          (local CLI: --profile neonema-tools)
├── S3: neonema-tools-prod        (tools.neonema.com)
├── S3: neonema-tools-dev         (dev.tools.neonema.com)
├── CloudFront: tools-prod        (OAC → prod bucket)
├── CloudFront: tools-dev         (OAC → dev bucket)
├── ACM (us-east-1): tools.neonema.com, dev.tools.neonema.com
├── CloudFront Function: revealip-ip-api  (/api/ip on tools-prod)
└── IAM: GitHub OIDC role         (deploy on push to main / dev)
```

Local deploys from this repo use the **`neonema-tools`** AWS CLI profile. See `docs/infra/README.md` for setup. Legacy per-app buckets/distributions can be retired after cutover and redirect verification.

---

## Priority tiers

Work top-to-bottom. Later tiers depend on earlier ones.

| Priority | Theme | Items covered | Outcome |
|----------|-------|---------------|---------|
| **P0** | Decisions & guardrails | 1, 2 | Everyone builds the same way; constraints are written down |
| **P1** | Production hosting | 3, 8 (infra half) | `tools.neonema.com` exists and is deployable |
| **P2** | Hub UX & tool integration | 5 | Users pick tools via tabs on one page |
| **P3** | Legacy cutover | 4 | Old domains redirect; old AWS stacks can be decommissioned |
| **P4** | Platform velocity | 7 | LLM agent guide (`ADD_A_TOOL.md`) + optional scaffold; manual hub registration |
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

- [ ] **P1.1** Consolidate legacy RevealIP / JSON stacks into the **NeoNema tools AWS account** (separate from the `neonema.com` company account) — configure local CLI profile **`neonema-tools`** — see `docs/infra/README.md`
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

#### P1.1 — Tools AWS account + `neonema-tools` profile

**Explanation:** Legacy RevealIP and JSON stacks move into the dedicated **NeoNema tools AWS account** (not the company account hosting `neonema.com`). One IAM model, one billing view, and one OIDC deploy role (P5) apply within the tools account. Local deploys use the **`neonema-tools`** AWS CLI profile.

**Manual verification:**

```bash
aws sts get-caller-identity --profile neonema-tools
# Confirm Account ID is the NeoNema tools account (not company or legacy RevealIP/JSON accounts)
aws s3 ls --profile neonema-tools | grep neonema-tools-prod
grep '"neonema-tools"' deploy.config.example.json
```

Follow `docs/infra/README.md` for profile setup and migration checklist. Legacy buckets should still exist only if cutover is not finished.

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

**Explanation:** Tool subtrees are deployed at `/json/` and `/revealip/` for iframe assets and `/api/ip`. Public landing URLs redirect to hub hash routes (`/#/json`, `/#/revealip`).

**Manual verification:**

```bash
curl -sI "https://tools.neonema.com/json/" | grep -iE "HTTP/|location"
curl -sI "https://tools.neonema.com/revealip/" | grep -iE "HTTP/|location"
curl -sI "https://tools.neonema.com/json/index.html" | head -3
```

Expect `301` + `Location: .../#/json` (or revealip) for directory paths; `index.html` still `200` for iframe loads. Browser: `/#/json` and `/#/revealip` work in the hub; RevealIP IP lookup succeeds via `/api/ip`.

---

#### P1 phase complete

**Explanation:** Production origin exists at `tools.neonema.com` with unified build output. Hub hash routes are the public entry; tool subtrees serve iframe assets.

**Manual verification:**

```bash
npm run build && npm run brand:check
curl -sI "https://tools.neonema.com/" | grep -i "HTTP/"
curl -sI "https://tools.neonema.com/json/" | grep -i location
curl -s "https://tools.neonema.com/api/ip"
```

Root should be `200`; `/json/` should `301` to `/#/json`. IP API returns valid JSON.

---

## P2 — Tools hub with tab navigation

**Covers:** requirements 3, 5  
**Effort:** ~1 day (mostly done in repo)  
**Depends on:** P1 (or local `npm run build` preview)

The hub shell, hash router, iframe panels, and build integration already live under `apps/hub/`. P2 is **verification and polish**, not a greenfield build. New tools are registered manually — see `docs/platform/ADD_A_TOOL.md` (completed in P4).

### Checklist

- [x] **P2.1** `apps/hub/` with NeoNema brand shell (`public/index.html`, `styles.css`, `app.js`)
- [x] **P2.2** Tab bar rendered from `apps/hub/hub.config.json` (explicit entries per tool — not auto-discovered from `apps/`)
- [x] **P2.3** Hash router: `#/json`, `#/revealip`, default tab from `defaultTool` (`apps/hub/public/app.js`)
- [x] **P2.4** Tool panels via iframe (`path` in hub config, e.g. `/json/index.html`)
- [x] **P2.5** Hub meta: title “NeoNema Tools”, description (`apps/hub/public/index.html`)
- [x] **P2.6** Hub included in `brand:check` (via `apps/*/public` scan)
- [x] **P2.7** Hub at `dist/index.html`; `hub.config.json` copied by `scripts/build.mjs`
- [x] **P2.8** Device / deep-link smoke test: mobile tab bar, `tools.neonema.com/#/revealip`, hash navigation

### Implementation notes

**`apps/hub/hub.config.json`** lists tools the hub should show. Adding a tab means appending an entry here and in `scripts/build.mjs` — documented in `ADD_A_TOOL.md`.

```json
{
  "defaultTool": "json",
  "tools": [
    { "id": "json", "label": "JSON Toolkit", "path": "/json/index.html", "description": "Validate, format, convert JSON" },
    { "id": "revealip", "label": "RevealIP", "path": "/revealip/index.html", "description": "Show your public IP" }
  ]
}
```

- `app.js` reads config at runtime, renders tabs, and switches `location.hash`; iframes load tool `path` values.
- Tool subtrees stay in `dist/` for iframe `src`, assets, and legal pages. Top-level visits to `/json/` or `/revealip/` redirect to the hub (`#/json`, `#/revealip`).

### Step verification

#### P2.1–P2.7 — Hub shell, config, router, build

**Explanation:** Hub exists with brand shell, `hub.config.json`-driven tabs, hash routing, iframes, and `dist/` integration.

**Manual verification:**

```bash
test -d apps/hub/public && test -f apps/hub/public/app.js && test -f apps/hub/hub.config.json
npm run build && test -f dist/index.html && test -f dist/hub.config.json
npm run brand:check
```

Browser (local `python3 -m http.server 8765 --directory dist`):

1. Tab bar shows **JSON Toolkit** and **RevealIP** from config.
2. Click **RevealIP** — URL becomes `#/revealip`; iframe loads `/revealip/index.html`.
3. Open `/#/json` in a new tab — JSON tab is active on load.

---

#### P2.8 — Device and deep-link test

**Explanation:** Hub works on mobile; production deep links land on the correct tab.

**Manual verification:**

Production (or staging):

1. `https://tools.neonema.com/#/revealip` — RevealIP tab active, tool works.
2. `https://tools.neonema.com/#/json` — JSON tab active.
3. Phone or DevTools device mode — tab bar usable; no horizontal overflow on body.

Use `docs/deploy/device-test-checklist.md` for a fuller pass if desired.

---

#### P2 phase complete

**Explanation:** `tools.neonema.com` root is the tabbed hub; tools work inside tabs via hash routes (`#/json`, `#/revealip`). Direct tool landing paths redirect to the hub.

**Manual verification:**

```bash
npm run build && npm run brand:check
```

Browser checklist:

- [x] Root hub loads with tabs
- [x] `#/json` and `#/revealip` deep links work
- [x] Mobile layout acceptable

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

## P4 — Platform velocity (LLM guide & optional scaffold)

**Covers:** requirement 7  
**Effort:** ~1–2 days  
**Depends on:** P0, P1, P2 (patterns proven once)

**Primary deliverable:** `docs/platform/ADD_A_TOOL.md` — the runbook agents read when adding a tool (template → implement → register in `hub.config.json` + `build.mjs` → verify → deploy). Tools do **not** appear on the hub automatically.

### Checklist

- [x] **P4.1** `docs/platform/ADD_A_TOOL.md` — end-to-end checklist for agents and contributors
- [ ] **P4.2** Optional `scripts/scaffold-tool.mjs` — copies `packages/utility-template/` → `apps/<name>/`, runs `sync-brand` (does **not** modify hub or build)
- [ ] **P4.3** Optional `npm run scaffold -- <tool-id> "<Tool Label>"` npm script
- [ ] **P4.4** `docs/platform/TOOL_CHECKLIST.md` — pre-ship: legal pages, robots.txt, device test, accessibility smoke
- [ ] **P4.5** Extend CI: `brand:check` already scans apps; add build dry-run on PR
- [ ] **P4.6** Optional cookie-cutter GitHub PR template for new tools
- [ ] **P4.7** Cross-link `ADD_A_TOOL.md` from `AGENTS.md` and `LLM_PRODUCT_RULES.md` (AGENTS done)

### Implementation notes

**Target flow for a new tool (agent-directed):**

1. Follow `docs/platform/ADD_A_TOOL.md` — copy template, implement `app.js`, register in `hub.config.json` and `scripts/build.mjs`
2. `npm run brand:check && npm run build` (~1 min)
3. Merge to `main` → auto deploy (after P5)

Optional scaffold script only creates `apps/<name>/` from `packages/utility-template/`; hub and build registration stay manual steps in `ADD_A_TOOL.md`.

Keep `packages/utility-template/` as the only scaffold source; never fork manually.

### Step verification

#### P4.1 — `docs/platform/ADD_A_TOOL.md`

**Explanation:** Canonical agent runbook: create app, implement tool, manually register in `hub.config.json` and `scripts/build.mjs`, verify, deploy.

**Manual verification:**

```bash
test -f docs/platform/ADD_A_TOOL.md
grep -iE "hub.config|build.mjs|brand:check|no auto" docs/platform/ADD_A_TOOL.md
grep "ADD_A_TOOL" AGENTS.md
```

Walk through the doc — every step should map to files that exist in the repo.

---

#### P4.2 — Optional `scripts/scaffold-tool.mjs`

**Explanation:** Helper copies `utility-template` to `apps/<name>/` and runs brand sync only. It does **not** edit hub config or `build.mjs`.

**Manual verification:**

```bash
test -f scripts/scaffold-tool.mjs && echo "OK"
node scripts/scaffold-tool.mjs --help 2>/dev/null || head -20 scripts/scaffold-tool.mjs
```

Dry run on a throwaway name in a git branch:

```bash
npm run scaffold -- test-tool "Test Tool"
test -d apps/test-tool/public && npm run brand:check
! grep "test-tool" apps/hub/hub.config.json  # scaffold must not auto-register
git checkout -- . && git clean -fd apps/test-tool
```

---

#### P4.3 — Optional `npm run scaffold` script

**Explanation:** Package.json exposes scaffold as a documented one-liner.

**Manual verification:**

```bash
grep "scaffold" package.json
npm run scaffold -- 2>&1 | head -5
```

---

#### P4.4 — `docs/platform/TOOL_CHECKLIST.md`

**Explanation:** Pre-ship checklist covers legal pages, `robots.txt`, device test, and accessibility smoke.

**Manual verification:**

```bash
test -f docs/platform/TOOL_CHECKLIST.md
grep -iE "privacy|terms|robots" docs/platform/TOOL_CHECKLIST.md
```

Cross-check against an existing app:

```bash
ls apps/json/public/privacy-policy.html apps/json/public/terms.html
```

---

#### P4.5 — CI build dry-run on PR

**Explanation:** Pull requests run `npm run build` so broken hub/build integration is caught before merge.

**Manual verification:**

```bash
grep -E "build|brand:check" .github/workflows/ci.yml
npm run build
```

---

#### P4.6 — PR template for new tools

**Explanation:** GitHub PR template reminds authors of `ADD_A_TOOL.md`, legal pages, and brand check.

**Manual verification:**

```bash
test -f .github/pull_request_template.md && grep -iE "tool|brand|ADD_A_TOOL" .github/pull_request_template.md
```

---

#### P4 phase complete

**Explanation:** Agents have a single doc for adding tools; optional scaffold speeds template copy only.

**Manual verification:**

```bash
test -f docs/platform/ADD_A_TOOL.md && npm run brand:check && npm run build
```

Mental walkthrough: follow `ADD_A_TOOL.md` for a hypothetical tool — all referenced paths exist.

---

## P5 — GitHub Actions → AWS deploy

**Covers:** requirement 8  
**Effort:** ~1–2 days  
**Depends on:** P1 (prod infra), P4 (build script stable)

### Checklist

- [ ] **P5.1** Create IAM OIDC identity provider for GitHub in the **NeoNema tools AWS account**
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
| `deploy.config.local.json` | No (gitignored) | overrides + `awsProfile: "neonema-tools"` for local dev |
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
- [ ] P1.1 Tools AWS account + `neonema-tools` profile
- [ ] P1.2–P1.5 S3 + CloudFront + ACM + DNS for tools.neonema.com
- [ ] P1.6 `scripts/build.mjs`
- [ ] P1.7–P1.10 Deploy config + RevealIP edge on unified distribution + smoke test

### P2 — Hub & tabs
- [x] P2.1–P2.8 Hub shell, tabs, hash router, iframes, build integration, device/deep-link smoke test

### P3 — Legacy redirects
- [ ] P3.1–P3.8 Cloudflare redirects + decommission old stacks

### P4 — Platform velocity
- [x] P4.1 `docs/platform/ADD_A_TOOL.md` (LLM agent runbook)
- [ ] P4.2–P4.7 Optional scaffold, TOOL_CHECKLIST, CI build, PR template

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
| **Sprint 2** | P2 + P3 | Tabbed hub verified; legacy domains redirect |
| **Sprint 3** | P4 + P5 | `ADD_A_TOOL.md` + optional scaffold; merge to `main` deploys prod |
| **Sprint 4** | P6 + P7 | Dev URL; company site cross-links |

---

## Repo changes preview (not yet implemented)

New paths this plan will add over time:

```
apps/hub/                          # tools.neonema.com shell + tabs (hub.config.json)
scripts/build.mjs                  # assemble dist/ for deploy
scripts/scaffold-tool.mjs          # optional: copy utility-template only (P4)
dist/                              # build output (gitignored)
deploy.config.prod.json            # CI-safe prod config
deploy.config.dev.json             # dev config
.github/workflows/deploy-prod.yml
.github/workflows/deploy-dev.yml
docs/platform/
  ARCHITECTURE.md
  ADD_A_TOOL.md                    # LLM agent runbook for new tools (P4)
  TOOL_CHECKLIST.md
  DOMAIN_CUTOVER.md
  ENVIRONMENTS.md
infra/                             # optional Terraform/CDK (P1/P5)
```

---

## Open decisions (resolve in P0)

| Decision | Options | **Resolved** |
|----------|---------|--------------|
| AWS account layout | Single account for everything vs tools + company split | **Two accounts** — NeoNema tools account (`neonema-tools` profile) for this repo; company account for `neonema.com` |
| Tab content loading | iframe vs inlined HTML/JS | **iframe first** (P0.5); inlined later for polish |
| Dev deploy trigger | `dev` branch vs manual dispatch | `dev` branch auto-deploy + manual dispatch for hotfixes |
| IaC timing | Manual AWS Console vs Terraform now | Console for Sprint 1; Terraform before P5 |
| Default hub tab | Landing page vs first tool | `defaultTool` in `hub.config.json` (currently `json`) |
| AdSense | Per-tool only vs hub too | Per-tool subtrees only (current pattern) |

---

## Hub-only public URLs (implemented)

Public entry is the hub and hash routes only — not standalone `/json/` or `/revealip/` landing pages.

| Layer | Implementation |
|-------|----------------|
| CloudFront `tools-uri-rewrite` | `301` from `/json`, `/json/`, `/revealip`, `/revealip/` → `/#/<tool-id>` |
| Tool `index.html` | Top-level visit redirects to hub; iframe embed unchanged |
| `dist/` layout | Tool subtrees remain for iframe `src`, assets, legal pages, `/api/ip` |

When adding a tool, include the hub-redirect script from `packages/utility-template` (see `ADD_A_TOOL.md`). Republish `tools-uri-rewrite` in CloudFront when adding a new tool root path to the edge redirect list.

---

## Related docs

- [platform/ARCHITECTURE.md](./platform/ARCHITECTURE.md) — canonical platform model (P0)
- [platform/ADD_A_TOOL.md](./platform/ADD_A_TOOL.md) — how agents add a tool (hub + build registration)
- [deploy/README.md](./deploy/README.md) — current S3 + CloudFront runbooks
- [deploy/automated-deploy.md](./deploy/automated-deploy.md) — local deploy scripts (Phase 3)
- [infra/README.md](./infra/README.md) — two-account model, `neonema-tools` CLI profile
- [PHASE_1_CHECKLIST.md](./PHASE_1_CHECKLIST.md) — monorepo migration (complete)
- [PHASE_3_CHECKLIST.md](./PHASE_3_CHECKLIST.md) — local deploy automation (complete)

---

## Next step

**P0–P2 are complete** (hub shell, tabs, hash router, iframes, build, device/deep-link verification). **`ADD_A_TOOL.md` is the agent runbook for new tools.**

Continue **P1** if any production infra items remain open, then **P3** (legacy domain redirects). Use `docs/platform/ADD_A_TOOL.md` whenever an agent adds a tool — no auto-registration on the hub.
