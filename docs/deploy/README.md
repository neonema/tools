# Deployment Guides

Shared runbooks for NeoNema static utility sites (S3 + CloudFront + optional Cloudflare + AdSense).

## Target: single-origin platform deploy

**Default model for new work:** one S3 bucket + one CloudFront distribution at `tools.neonema.com`.

| URL path | Source in repo | Build output |
|----------|----------------|--------------|
| `/` | `apps/hub/public/` | `dist/index.html` |
| `/json/` | `apps/json/public/` | `dist/json/` |
| `/revealip/` | `apps/revealip/public/` | `dist/revealip/` |

`scripts/build.mjs` assembles `dist/`; deploy with `npm run deploy -- platform` (P1). Full spec: [platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md).

**Interim:** per-app buckets and `npm run deploy -- json` / `revealip` still work until cutover into the NeoNema tools account (`neonema-tools` profile for platform deploy).

**AWS accounts:** `tools.neonema.com` deploys to the **NeoNema tools account** via profile `neonema-tools`. `neonema.com` is a separate account/repo. See [infra/README.md](../infra/README.md).

## Guides

| Guide | Description |
|-------|-------------|
| [aws-s3-cloudfront.md](./aws-s3-cloudfront.md) | S3 bucket, CloudFront distribution, OAC, ACM |
| [cloudflare-dns.md](./cloudflare-dns.md) | Cloudflare DNS → CloudFront |
| [adsense.md](./adsense.md) | Google AdSense setup |
| [device-test-checklist.md](./device-test-checklist.md) | Pre-release QA checklist |
| [order-of-operations.md](./order-of-operations.md) | RevealIP launch sequence |
| [revealip-cloudfront-function.md](./revealip-cloudfront-function.md) | Edge function for `/api/ip` |
| [automated-deploy.md](./automated-deploy.md) | `npm run deploy` scripts (S3 sync + invalidation) |

## Deploy paths

### Platform (target)

Upload `dist/` after `npm run build`:

- `dist/index.html` → bucket root (`tools.neonema.com/`)
- `dist/json/*` → `json/` prefix
- `dist/revealip/*` → `revealip/` prefix
- RevealIP `/api/ip` → CloudFront Function on the **same** distribution

### Per-app (interim / legacy)

Upload the **contents** of each app's `public/` folder to a dedicated bucket root:

| App | Local path | Notes |
|-----|------------|-------|
| RevealIP | `apps/revealip/public/` | Requires CloudFront Function for `/api/ip` |
| JSON Toolkit | `apps/json/public/` | Fully static; no edge functions |

## Monorepo convention

- Platform hub homepage: `index.html` at bucket root (from `apps/hub/public/`)
- Tool subtrees: `json/index.html`, `revealip/index.html`, etc.
- After deploy, invalidate CloudFront cache for changed paths
- `ads.txt` and `robots.txt` live in each app's `public/` folder
