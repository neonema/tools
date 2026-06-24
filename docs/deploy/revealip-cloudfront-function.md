# RevealIP CloudFront Function (`/api/ip`)

RevealIP is the only current app that requires an edge function. The JSON toolkit is fully static.

## Source file

`apps/revealip/cloudfront/ip-api-function.js`

## Setup

1. Open AWS Console → **CloudFront** → **Functions** → **Create function**.
2. Name: e.g. `revealip-ip-api`.
3. Runtime: CloudFront Functions (JavaScript).
4. Paste code from `apps/revealip/cloudfront/ip-api-function.js`.
5. Save and **Publish** the function.

## Attach to distribution

1. Open your CloudFront distribution → **Behaviors**.
2. Create a behavior for path pattern `/api/ip` (order above the default `*`).
3. Origin: same S3 origin as the static site.
4. Attach the function to **Viewer request**.
5. Deploy and test: `https://<distribution>/api/ip` should return JSON with `ipv4`, `ipv6`, `preferred`.

## Local development

`/api/ip` does not work with `npm run dev:revealip` unless you mock the endpoint. Test IP detection through a deployed CloudFront distribution or the function test console in AWS.
