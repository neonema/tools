# NeoNema Tools Platform — Architecture

Canonical reference for how NeoNema utility products are hosted, built, and constrained.  
**Production URL (target):** `https://tools.neonema.com`

See also: [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) for the full execution checklist.

---

## Single-origin hosting model

All tools ship from **one S3 bucket** and **one CloudFront distribution** at `tools.neonema.com`. Each tool is a static subtree; the hub is the site root.

```
tools.neonema.com/              → apps/hub/public/          (tab shell + tool picker)
tools.neonema.com/json/         → apps/json/public/         (JSON Toolkit)
tools.neonema.com/revealip/     → apps/revealip/public/     (RevealIP)
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

---

## Hub and tab routing

The hub (`apps/hub/`) is a lightweight static shell (scaffolded in P2):

- Fixed NeoNema header (shared brand lock)
- Horizontal tab bar driven by `hub.config.json`
- Client-side routes: `#/json`, `#/revealip` (hash or `history.pushState`)
- Deep links: `tools.neonema.com/#/json` and legacy domain redirects land on the correct tab

Each tool's `index.html` stays **self-contained** so direct URLs (`/json/`, `/revealip/`) work for bookmarks, SEO, and legacy redirects.

### Tab content embedding (decision: P0.5)

**Use iframes first** (`src="/json/index.html"`, etc.) when building the hub in P2.

| Approach | Pros | Cons |
|----------|------|------|
| **iframe (chosen)** | Fast to ship; tools unchanged; direct URLs still work | Nested document; iframe height/CSS quirks |
| Inlined HTML/JS | Single document; tighter UX | Build complexity; duplicate header risk |

Revisit inlined modules in P4 if iframe polish becomes a blocker.

---

## Domain map

| Hostname | Role |
|----------|------|
| `tools.neonema.com` | Tools hub + all tools (production) |
| `dev.tools.neonema.com` | Staging / preview |
| `neonema-revealip.com` | 301 → `https://tools.neonema.com/#/revealip` |
| `neonema-json.com` | 301 → `https://tools.neonema.com/#/json` |
| `neonema.com` | Company marketing site (separate repo); links out to tools hub |

---

## AWS layout (target)

```
NeoNema LLC AWS account
├── S3: neonema-tools-prod        (tools.neonema.com)
├── S3: neonema-tools-dev         (dev.tools.neonema.com)
├── CloudFront: tools-prod        (OAC → prod bucket)
├── CloudFront: tools-dev         (OAC → dev bucket)
├── ACM (us-east-1): *.neonema.com + neonema.com
└── IAM: GitHub OIDC role         (deploy on push to main / dev)
```

Legacy per-app buckets and distributions retire after P3 cutover and redirect verification.

---

## Monorepo layout

| Path | Purpose |
|------|---------|
| `apps/hub/` | Tools hub shell + tab navigation |
| `apps/<tool>/public/` | Deployable static files per tool |
| `packages/brand/` | Canonical design tokens and header lock |
| `packages/utility-template/` | Scaffold for new tools |
| `scripts/build.mjs` | Assemble `dist/` for platform deploy |
| `dist/` | Build output (gitignored) |

---

## Related docs

- [deploy/README.md](../deploy/README.md) — S3 + CloudFront runbooks
- [deploy/automated-deploy.md](../deploy/automated-deploy.md) — local deploy scripts
- [infra/README.md](../infra/README.md) — AWS account consolidation
- [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) — priority checklist (P0–P7)
