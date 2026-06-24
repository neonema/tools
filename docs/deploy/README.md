# Deployment Guides

Shared runbooks for NeoNema static utility sites (S3 + CloudFront + optional Cloudflare + AdSense).

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

## Per-app deploy paths

Upload the **contents** of each app's `public/` folder to the S3 bucket root:

| App | Local path | Notes |
|-----|------------|-------|
| RevealIP | `apps/revealip/public/` | Requires CloudFront Function for `/api/ip` |
| JSON Toolkit | `apps/json/public/` | Fully static; no edge functions |

## Monorepo convention

- Object key for homepage: `index.html` at bucket root
- After deploy, invalidate CloudFront cache for changed paths
- `ads.txt` and `robots.txt` live in each app's `public/` folder
