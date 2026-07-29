# Deployment Guides

Runbooks for the NeoNema tools platform: one S3 bucket + one CloudFront distribution serving `tools.neonema.com`, with DNS in Cloudflare.

## Deploy model

| URL path | Source in repo | Build output |
|----------|----------------|--------------|
| `/` | `apps/hub/public/` | `dist/index.html` |
| `/json/` | `apps/json/public/` | `dist/json/` (iframe assets; 301s to `/#/json` if opened directly) |
| `/revealip/` | `apps/revealip/public/` | `dist/revealip/` (iframe assets; 301s to `/#/revealip`) |
| `/api/ip` | `apps/revealip/cloudfront/ip-api-function.js` | CloudFront Function on the same distribution |

`scripts/build.mjs` assembles `dist/`; push to `main` deploys it, or run `npm run deploy -- platform` locally. Full spec: [platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md).

**AWS accounts:** `tools.neonema.com` lives in the NeoNema tools account (profile `neonema-tools`). `neonema.com` is a separate account and repo. See [infra/README.md](../infra/README.md).

## Guides

| Guide | Description |
|-------|-------------|
| [automated-deploy.md](./automated-deploy.md) | CI deploy and local `npm run deploy` fallback |
| [aws-s3-cloudfront.md](./aws-s3-cloudfront.md) | S3 bucket, CloudFront distribution, OAC, ACM |
| [cloudflare-dns.md](./cloudflare-dns.md) | Cloudflare DNS → CloudFront |
| [edge-functions.md](./edge-functions.md) | Edge functions: `/api/ip` and directory URLs |

## Conventions

- Hub `index.html` sits at the bucket root; tools live under `json/`, `revealip/`, … prefixes.
- `robots.txt` at the origin root (`apps/hub/public/`) governs crawling for the whole site.
- Invalidate CloudFront after deploy — `npm run deploy` does this for `/*` by default.
- No `ads.txt` and no ad or analytics scripts anywhere on the platform.
