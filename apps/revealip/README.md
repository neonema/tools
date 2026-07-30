# RevealIP

Static IP display site for deployment on S3 with CloudFront.

## What is in this app

- `public/` — static website files
- `cloudfront/ip-api-function.js` — CloudFront Function for `/api/ip`

## Behavior

- Shows IPv4 and IPv6 when available
- Prefers IPv4 as primary if both are present
- Falls back to IPv6 if IPv4 is not available
- Shows "not found" if neither is available

## Local preview

From the monorepo root:

```bash
npm run dev
```

Open [http://localhost:8765/#/revealip](http://localhost:8765/#/revealip) — the hub loads this tool in its iframe, the same way production does.

Note: `/api/ip` only works through CloudFront (or a local mock endpoint).

## Deploy

This tool deploys as part of the platform — `npm run build` copies `public/` into `dist/revealip/`, and a push to `main` ships it. See [docs/DEPLOY.md](../../docs/DEPLOY.md).

The `/api/ip` edge function is published separately, only when `cloudfront/ip-api-function.js` changes:

```bash
npm run deploy:edge -- platform
```

Public entry is `https://tools.neonema.com/#/revealip`. Setup details: [docs/DEPLOY.md](../../docs/DEPLOY.md#edge-functions).
