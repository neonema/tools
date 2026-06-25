# NeoNema Tools Platform — Architecture

Canonical reference for how NeoNema utility products are hosted, built, and constrained.  
**Production URL (target):** `https://tools.neonema.com`

See also: [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) for the full execution checklist.

---

## Single-origin hosting model

All tools ship from **one S3 bucket** and **one CloudFront distribution** at `tools.neonema.com`. Each tool is a static subtree; the hub is the site root.

```
tools.neonema.com/              → apps/hub/public/          (tab shell + tool picker)
tools.neonema.com/#/json        → JSON Toolkit (hub tab; public entry)
tools.neonema.com/#/revealip    → RevealIP (hub tab; public entry)
tools.neonema.com/json/...      → apps/json/public/         (iframe assets only — not a public landing URL)
tools.neonema.com/revealip/...  → apps/revealip/public/     (iframe assets only — not a public landing URL)
```

**Build step:** `scripts/build.mjs` (P1) assembles a deployable tree into `dist/` before `aws s3 sync`:

```
dist/
  index.html              ← apps/hub/public/index.html
  hub.js, hub.css         ← apps/hub/public/*
  json/                   ← apps/json/public/*
  revealip/               ← apps/revealip/public/*
```

**Why one origin:** one ACM certificate, one invalidation target, one deploy workflow, simpler DNS. Tools remain independent folders in the monorepo (`apps/<name>/`).

### Current vs target deploy

| State | Deploy model |
|-------|--------------|
| **Today** | Per-app buckets/distributions (`npm run deploy -- json`, `npm run deploy -- revealip`) |
| **Target** | Unified `dist/` → `neonema-tools-prod` bucket via `npm run deploy -- platform` |

Per-app deploy scripts remain valid during migration. New docs and infra work should assume the single-origin model.

---

## Static-only / no data transfer constraint

| Allowed | Not allowed (without explicit approval) |
|---------|----------------------------------------|
| Static files from CloudFront | NeoNema API servers, databases, Lambdas (except documented edge exceptions) |
| All tool logic in browser (`app.js`) | Sending user input to NeoNema infrastructure |
| Third-party edge/CDN (CloudFront, Cloudflare) | Logging pipelines that store user content |
| Google AdSense (third-party, optional) | Analytics that exfiltrate tool input |

**Rules for agents and contributors:**

- Tools process data **in the browser only**.
- No `fetch()` to NeoNema-owned APIs.
- Each tool subtree must include `privacy-policy.html` and `terms.html`.

---

## Documented edge exception — RevealIP `/api/ip`

RevealIP cannot detect the viewer's public IP purely in the browser. `/api/ip` is served by a **CloudFront Function** at the edge (`apps/revealip/cloudfront/ip-api-function.js`). It returns the viewer's public IP to the browser only; NeoNema does not persist it.

On the unified distribution, this function attaches to path `/api/ip*` on the **same** CloudFront distribution as static content. See [revealip-cloudfront-function.md](../deploy/revealip-cloudfront-function.md).

Do not add similar edge infrastructure to other apps unless explicitly requested and documented here.

### Directory URLs and hub-only public entry

S3 REST origins only apply **Default root object** at `/`. Tool subtrees (`/json/`, `/revealip/`) still exist in `dist/` for hub iframe `src`, static assets, and legal pages.

**Public entry is the hub only** — hash routes (`#/json`, `#/revealip`). Direct tool landing paths redirect to the hub:

| Layer | Behavior |
|-------|----------|
| CloudFront **`tools-uri-rewrite`** | `301` from `/json`, `/json/`, `/revealip`, `/revealip/` → `/#/<tool-id>` |
| Tool `index.html` (top-level visit) | `location.replace` to `/#/<tool-id>` when not embedded in the hub iframe |
| Hub iframe | Loads `/json/index.html`, `/revealip/index.html` unchanged (`window.self !== window.top`) |

`npm run dev:json` / `dev:revealip` still work — standalone dev servers serve the tool at `/`, which does not match the redirect path check.

---

## Hub and tab routing

The hub (`apps/hub/`) is a lightweight static shell (scaffolded in P2):

- Fixed NeoNema header (shared brand lock)
- Horizontal tab bar driven by `hub.config.json` (each tool registered explicitly — see [ADD_A_TOOL.md](./ADD_A_TOOL.md))
- Client-side routes: `#/json`, `#/revealip` (hash or `history.pushState`)
- Deep links: `tools.neonema.com/#/json` and legacy domain redirects land on the correct tab

Tool `index.html` files redirect top-level visits from `/json/` and `/revealip/` to the hub. Subpaths (assets, `privacy-policy.html`, `terms.html`) and iframe embeds are unchanged.

### Tab content embedding (decision: P0.5)

**Use iframes first** (`src="/json/index.html"`, etc.) when building the hub in P2.

| Approach | Pros | Cons |
|----------|------|------|
| **iframe (chosen)** | Fast to ship; tools unchanged; hub-only public URLs | Nested document; iframe height/CSS quirks |
| Inlined HTML/JS | Single document; tighter UX | Build complexity; duplicate header risk |

Revisit inlined modules in P4 if iframe polish becomes a blocker.

---

## Domain map

| Hostname | Role |
|----------|------|
| `tools.neonema.com` | Tools hub + all tools (production) |
| `dev.tools.neonema.com` | Staging / preview |
| `revealip-neonema.com` | 301 → `https://tools.neonema.com/#/revealip` |
| `json-neonema.com` | 301 → `https://tools.neonema.com/#/json` |
| `www.revealip-neonema.com`, `www.json-neonema.com` | Same targets — **backlog** ([DOMAIN_CUTOVER.md](./DOMAIN_CUTOVER.md)) |
| `neonema.com` | Company marketing site (separate repo + AWS account); links out to tools hub |

---

## AWS accounts (target)

NeoNema uses **two AWS accounts** — tools and company site — with DNS in Cloudflare routing each hostname to the right CloudFront distribution. This repo (`neonema-tools`) deploys **only** to the **NeoNema tools account**.

| Account | Hostnames | Owned by |
|---------|-----------|----------|
| **NeoNema tools** | `tools.neonema.com`, `dev.tools.neonema.com` | This repo |
| **NeoNema company** | `neonema.com` | Separate company-site repo; links out to tools hub (P7) |

No cross-account S3 origins: each CloudFront distribution reads buckets in its own account via OAC.

### Tools account layout

```
NeoNema tools AWS account          (local CLI: --profile neonema-tools)
├── S3: neonema-tools-prod        (tools.neonema.com)
├── S3: neonema-tools-dev         (dev.tools.neonema.com)
├── CloudFront: tools-prod        (OAC → prod bucket)
├── CloudFront: tools-dev         (OAC → dev bucket)
├── ACM (us-east-1): tools.neonema.com, dev.tools.neonema.com
├── CloudFront Function: revealip-ip-api  (/api/ip on tools-prod)
├── CloudFront Function: tools-uri-rewrite  (tool root paths → hub hash; other dirs → index.html)
└── IAM: GitHub OIDC role         (deploy on push to main / dev)
```

**Local deploy profile:** set `awsProfile` to `"neonema-tools"` in `deploy.config.json`. See [infra/README.md](../infra/README.md) for profile setup.

Legacy per-app buckets and distributions in old AWS accounts retire after P3 cutover and redirect verification.

---

## Monorepo layout

| Path | Purpose |
|------|---------|
| `apps/hub/` | Tools hub shell + tab navigation |
| `apps/<tool>/public/` | Deployable static files per tool |
| `packages/brand/` | Canonical design tokens and header lock |
| `packages/utility-template/` | Scaffold for new tools |
| `docs/platform/ADD_A_TOOL.md` | Agent runbook: create app + register hub tab + build |
| `scripts/build.mjs` | Assemble `dist/` for platform deploy |
| `dist/` | Build output (gitignored) |

---

## Related docs

- [deploy/README.md](../deploy/README.md) — S3 + CloudFront runbooks
- [deploy/automated-deploy.md](../deploy/automated-deploy.md) — local deploy scripts
- [infra/README.md](../infra/README.md) — two-account model, `neonema-tools` CLI profile
- [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) — priority checklist (P0–P7)
- [DOMAIN_CUTOVER.md](./DOMAIN_CUTOVER.md) — legacy domain 301 runbook and decommission timeline
