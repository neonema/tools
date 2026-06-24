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
npm run dev:revealip
```

Open [http://localhost:8080](http://localhost:8080).

Note: `/api/ip` only works through CloudFront (or a local mock endpoint).

## Deploy

1. Upload `apps/revealip/public/*` to your S3 bucket.
2. Create a CloudFront distribution with the bucket as origin.
3. Add CloudFront Function from `apps/revealip/cloudfront/ip-api-function.js`.
4. Attach the function to Viewer Request for path `/api/ip`.
5. Point your domain DNS (Cloudflare) to the CloudFront distribution.

See [docs/deploy/](../../docs/deploy/) for step-by-step guides. RevealIP-specific launch order: [order-of-operations.md](../../docs/deploy/order-of-operations.md).
