# Architecture

How NeoNema utility products are hosted, built, and constrained.
**Production:** `https://tools.neonema.com` — current state in [STATUS.md](./STATUS.md).

---

## Single-origin hosting model

All tools ship from **one S3 bucket** and **one CloudFront distribution**. Each tool is a static subtree; the hub is the site root.

```
tools.neonema.com/              → apps/hub/public/          (tab shell + tool picker)
tools.neonema.com/json/         → apps/json/public/         (indexable tool page; public entry)
tools.neonema.com/revealip/     → apps/revealip/public/     (indexable tool page; public entry)
tools.neonema.com/utc/          → apps/utc/public/          (indexable tool page; public entry)
tools.neonema.com/#/<tool-id>   → hub shows that tool tab, then clears the hash (legacy bookmarks)
```

`scripts/build.mjs` assembles the deployable tree into `dist/`:

```
dist/
  index.html              ← apps/hub/public/index.html
  app.js, styles.css      ← apps/hub/public/*
  hub.config.json         ← apps/hub/hub.config.json
  robots.txt              ← apps/hub/public/robots.txt   (governs the whole origin)
  sitemap.xml             ← generated from hub.config.json
  json/                   ← apps/json/public/*
  revealip/               ← apps/revealip/public/*
  utc/                    ← apps/utc/public/*
```

**Why one origin:** one ACM certificate, one invalidation target, one deploy workflow, simpler DNS. Tools stay independent folders in the monorepo (`apps/<name>/`).

---

## Static-only / no data transfer constraint

| Allowed | Not allowed (without explicit approval) |
|---------|----------------------------------------|
| Static files from CloudFront | NeoNema API servers, databases, Lambdas (except the documented edge exception) |
| All tool logic in the browser (`app.js`) | Sending user input to NeoNema infrastructure |
| Third-party edge/CDN (CloudFront, Cloudflare) | Logging pipelines that store user content |
| — | Analytics, ad networks, or any third-party tracking script |

**Rules for agents and contributors:**

- Tools process data **in the browser only**.
- No `fetch()` to NeoNema-owned APIs.
- Each tool subtree ships `privacy-policy.html` and `terms.html`.
- No ad or analytics scripts. The platform is not monetized.

---

## Edge functions

Two CloudFront Functions run on the production distribution. Both are published with `npm run deploy:edge -- platform` — see [DEPLOY.md](./DEPLOY.md).

### `revealip-ip-api` — the documented exception

RevealIP cannot detect the viewer's public IP purely in the browser. `/api/ip` is served by a CloudFront Function (`apps/revealip/cloudfront/ip-api-function.js`) attached to `/api/ip*` on **Viewer request**. It returns the viewer's IP to the browser only; NeoNema does not persist it.

Do not add similar edge infrastructure to other apps unless explicitly requested and documented here.

### `tools-uri-rewrite` — directory URLs

S3 REST origins only apply a **default root object** at `/`, so directory URLs need rewriting. The function (`apps/hub/cloudfront/uri-rewrite-function.js`) runs on the default `*` behavior:

| Request | Behavior |
|---------|----------|
| `/api/*`, paths with a file extension | Pass through |
| Directory paths (including `/json/`, `/revealip/`, `/utc/`) | Rewrite to `<path>/index.html` |

Tool root paths are **public, indexable pages** — they must return `200` with full HTML, not redirect to a hash route.

### Indexable paths + hub chrome

| Layer | Behavior |
|-------|----------|
| Tool `index.html` | Served at `/<tool-id>/`; canonical points at that path |
| Tool tab bar | Baked into every tool page at build time (`scripts/lib/tool-nav.mjs`) from `hub.config.json`, so a direct visit to `/utc/` shows the same top-level nav as `/`. Plain `<a href="/<tool-id>/">` links — full page loads, no JS needed, real internal linking for crawlers |
| Hub iframe | Loads `/<tool-id>/index.html`; detects embed via `window.self !== window.top` and applies `hub-embed`. Tools hide `.header` under that class, so the injected nav never double-renders inside the hub |
| Hub tabs | Real `<a href="/<tool-id>/">` links; left-click switches the iframe in-session without leaving `/` |
| Legacy `#/<tool-id>` | Hub clears the hash and shows that tool in the iframe (no hard navigation — avoids loops with stale path→hash redirects) |

`npm run dev` mounts tools at `/json/`, `/revealip/`, and `/utc/`. Work on a tool at its path URL or through the hub at `/`.

---

## Hub and tab routing

The hub (`apps/hub/`) is a lightweight static shell:

- Fixed NeoNema header (shared brand lock; company logo only — tools do not ship separate product logos)
- Horizontal tab bar driven by `hub.config.json` — each tool registered explicitly, see [ADD_A_TOOL.md](./ADD_A_TOOL.md)
- Tabs link to path URLs (`/json/`, …); in-session clicks keep the hub shell and swap iframes
- Tool panels load in **iframes** (`src="/json/index.html"`). Chosen for speed of shipping and because it leaves tools unchanged; revisit inlined modules only if iframe polish becomes a real blocker.

---

## Domain map

| Hostname | Role |
|----------|------|
| `tools.neonema.com` | Tools hub + all tools (production) |
| `revealip-neonema.com`, `www.revealip-neonema.com` | 301 → `https://tools.neonema.com/revealip/` |
| `json-neonema.com`, `www.json-neonema.com` | 301 → `https://tools.neonema.com/json/` |
| `neonema.com` | Company marketing site (separate repo + AWS account) |

There is no hosted staging environment — see [STATUS.md](./STATUS.md) for why. AWS accounts, DNS, and credentials: [INFRA.md](./INFRA.md).

---

## Related docs

- [STATUS.md](./STATUS.md) — what is live, open, and out of scope
- [ADD_A_TOOL.md](./ADD_A_TOOL.md) — building and shipping a tool
- [DEPLOY.md](./DEPLOY.md) — CI, local deploy, edge function publishing
- [INFRA.md](./INFRA.md) — AWS accounts, DNS, legacy domains
