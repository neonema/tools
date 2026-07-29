# Architecture

How NeoNema utility products are hosted, built, and constrained.
**Production:** `https://tools.neonema.com` — current state in [STATUS.md](./STATUS.md).

---

## Single-origin hosting model

All tools ship from **one S3 bucket** and **one CloudFront distribution**. Each tool is a static subtree; the hub is the site root.

```
tools.neonema.com/              → apps/hub/public/          (tab shell + tool picker)
tools.neonema.com/#/json        → JSON Toolkit (hub tab; public entry)
tools.neonema.com/#/revealip    → RevealIP (hub tab; public entry)
tools.neonema.com/json/...      → apps/json/public/         (iframe assets only — not a public landing URL)
tools.neonema.com/revealip/...  → apps/revealip/public/     (iframe assets only — not a public landing URL)
```

`scripts/build.mjs` assembles the deployable tree into `dist/`:

```
dist/
  index.html              ← apps/hub/public/index.html
  app.js, styles.css      ← apps/hub/public/*
  hub.config.json         ← apps/hub/hub.config.json
  robots.txt              ← apps/hub/public/robots.txt   (governs the whole origin)
  json/                   ← apps/json/public/*
  revealip/               ← apps/revealip/public/*
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

### `tools-uri-rewrite` — directory URLs and hub-only entry

S3 REST origins only apply a **default root object** at `/`, so directory URLs need rewriting. The function (`apps/hub/cloudfront/uri-rewrite-function.js`) runs on the default `*` behavior:

| Request | Behavior |
|---------|----------|
| `/json`, `/json/`, `/revealip`, `/revealip/` | `301` → `/#/<tool-id>` |
| Other directory paths | Rewrite to `<path>/index.html` |
| `/api/*`, paths with a file extension | Pass through |

**Add every new tool root path to that redirect list and republish**, otherwise the tool gets a second public URL.

### Layered hub-only entry

| Layer | Behavior |
|-------|----------|
| `tools-uri-rewrite` | `301` from tool root paths to the hub hash route |
| Tool `index.html` | `location.replace` to `/#/<tool-id>` on a top-level visit — belt-and-braces if the published function is stale |
| Tool `index.html` canonical | `https://tools.neonema.com/#/<tool-id>` so search consolidates on the hub URL |
| Hub iframe | Loads `/json/index.html` etc. unchanged, detected via `window.self !== window.top` |

`npm run dev:json` / `dev:revealip` still work — standalone dev servers serve the tool at `/`, which does not match the redirect path check.

---

## Hub and tab routing

The hub (`apps/hub/`) is a lightweight static shell:

- Fixed NeoNema header (shared brand lock)
- Horizontal tab bar driven by `hub.config.json` — each tool registered explicitly, see [ADD_A_TOOL.md](./ADD_A_TOOL.md)
- Client-side hash routes: `#/json`, `#/revealip`
- Deep links and legacy-domain redirects land on the correct tab
- Tool panels load in **iframes** (`src="/json/index.html"`). Chosen for speed of shipping and because it leaves tools unchanged; revisit inlined modules only if iframe polish becomes a real blocker.

---

## Domain map

| Hostname | Role |
|----------|------|
| `tools.neonema.com` | Tools hub + all tools (production) |
| `revealip-neonema.com`, `www.revealip-neonema.com` | 301 → `https://tools.neonema.com/#/revealip` |
| `json-neonema.com`, `www.json-neonema.com` | 301 → `https://tools.neonema.com/#/json` |
| `neonema.com` | Company marketing site (separate repo + AWS account) |

There is no hosted staging environment — see [STATUS.md](./STATUS.md) for why. AWS accounts, DNS, and credentials: [INFRA.md](./INFRA.md).

---

## Related docs

- [STATUS.md](./STATUS.md) — what is live, open, and out of scope
- [ADD_A_TOOL.md](./ADD_A_TOOL.md) — building and shipping a tool
- [DEPLOY.md](./DEPLOY.md) — CI, local deploy, edge function publishing
- [INFRA.md](./INFRA.md) — AWS accounts, DNS, legacy domains
