# RevealIP Launch Order (UI-first)

App path: `apps/revealip/`

## 1) Prepare the site files
1. In `apps/revealip/public/index.html`, replace AdSense placeholders if needed:
   - `ca-pub-7032115236198174`
   - `5347862929`
2. Confirm `apps/revealip/public/privacy-policy.html` and `apps/revealip/public/terms.html` are present (they are required for AdSense compliance review).

## 2) Build on AWS first (without custom domain)
1. Create an S3 bucket for the static site.
2. Upload all files from `apps/revealip/public/` to S3.
3. Create a CloudFront distribution with S3 as origin.
4. Create and attach CloudFront Function from `apps/revealip/cloudfront/ip-api-function.js` for `/api/ip` (Viewer Request). See [revealip-cloudfront-function.md](./revealip-cloudfront-function.md).
5. Validate using the CloudFront domain (`https://dxxxxx.cloudfront.net`):
   - Home page renders
   - `/api/ip` returns JSON
   - Privacy/Terms pages load

## 3) Connect Cloudflare domain
1. Add CloudFront custom domain (CNAME) + ACM certificate in AWS.
2. In Cloudflare DNS, point your chosen hostname to CloudFront.
3. Keep Cloudflare proxy enabled (orange cloud).
4. Force HTTPS and enable WAF/rate-limit/bot protections in Cloudflare.

## 4) Final production hardening
1. In CloudFront, add security headers policy and caching policy as needed.
2. In Cloudflare, enable:
   - Under Attack Mode (as needed)
   - Bot Fight Mode / Super Bot Fight Mode
   - WAF managed rules
   - Rate limiting
3. Re-test from multiple networks/devices.

## 5) AdSense onboarding
1. Submit site in AdSense.
2. Ensure crawler can access:
   - `/`
   - `/privacy-policy.html`
   - `/terms.html`
3. Wait for approval, then verify ad rendering in production.
