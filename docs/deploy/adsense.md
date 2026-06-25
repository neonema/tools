# Google AdSense Step-by-Step (Static site on S3 + CloudFront + Cloudflare)

> **Platform backlog:** NeoNema tools are **not monetized** today. A future task will remove AdSense scripts, ad slots, and `ads.txt` from the repo — see [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md#remove-adsense-backlog). This guide remains for reference if ads are re-enabled later.

This complements [aws-s3-cloudfront.md](./aws-s3-cloudfront.md) and [cloudflare-dns.md](./cloudflare-dns.md).

## Prerequisites

- A **live HTTPS site** on your own domain (CloudFront + ACM + Cloudflare DNS as in the other guides).
- **Enough original content** and a clear purpose; utility sites can qualify but must meet [program policies](https://support.google.com/adsense/answer/48182).
- **Privacy policy** that covers advertising and cookies if you use personalized ads (update `apps/<app-name>/public/privacy-policy.html` accordingly before or right after approval).
- Access to **Google AdSense** to apply and to retrieve your **publisher ID** and ad unit snippets after approval.

## A) Apply for AdSense

1. Sign in to [Google AdSense](https://www.google.com/adsense/) with a Google account.
2. Submit your **site URL** (use the final public URL, for example `https://json.example.com`).
3. Complete **site review** steps as shown in the console (AdSense may ask you to place a verification snippet or **ads.txt**—follow the exact instructions in your account).

## B) ads.txt (strongly recommended)

`ads.txt` tells advertisers which accounts are allowed to sell your inventory. It must be reachable at the **site root**:

`https://your-domain.com/ads.txt`

For this project:

1. Google will provide a line (or you will build it from your **publisher ID** in the format `google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0`—**use the values AdSense gives you**, not this example).
2. Create a file `ads.txt` locally with that content (one line per authorized entry, no HTML).
3. Upload **`ads.txt`** to the **root** of your S3 bucket (same level as `index.html`).
4. Invalidate CloudFront for `/ads.txt` after upload.
5. Verify in a browser: `https://your-domain.com/ads.txt` returns **200** and plain text.

If you use **Cloudflare proxy**, ensure no rule blocks the `ads.txt` path or rewrites it.

## C) Place the AdSense code on the site

After AdSense approves ad serving (or during setup if they instruct you to):

1. In AdSense, create an **ad unit** (or use **Auto ads** if you enable that).
2. Copy the **script snippet** they provide.
3. Add it to your HTML in the appropriate place (commonly before `</head>` or where Google specifies). For this monorepo, that means editing **`apps/<app-name>/public/index.html`** (and redeploying to S3 + invalidating CloudFront).

**Note:** The repository does not ship with AdSense code by default—you add it when your account is ready.

### Where ads usually go on this template

- You already have an **“Advertisement space”** block in the page layout (`aside.ad-box`). You can replace the placeholder with an AdSense **display ad** unit **or** rely on **Auto ads** to choose placements. Keep **above-the-fold** clutter reasonable for policy and UX.

## D) Privacy, consent, and regulations

- If you serve **personalized ads** in the EEA, UK, Switzerland, or where required, you may need a **consent** mechanism (for example a CMP aligned with IAB TCF where applicable). That is a product/legal decision beyond this repo.
- Update **privacy policy** and **cookie** disclosures to reflect AdSense, analytics, and Cloudflare/AWS processing as appropriate.

## E) Crawlers and Cloudflare

- AdSense and Google may **fetch your pages and ads.txt** for verification and ad matching.
- In **Cloudflare**, avoid aggressive firewall rules that block **Googlebot** or AdSense-related verification. If you use **Bot Fight Mode** or **WAF**, test after changes.
- Ensure **robots.txt** does not disallow important URLs unless intentional.

## F) Deploy checklist when you change ad-related files

1. Upload `index.html`, `ads.txt`, or any changed assets to S3.
2. Run **CloudFront invalidation** for those paths (at least `/index.html`, `/ads.txt`).
3. Re-check `ads.txt` and a page with ads in an incognito window.

## Common mistakes

- `ads.txt` uploaded under a **prefix** (wrong URL) or with **wrong Content-Type** / HTML wrapping.
- Forgetting to **invalidate** CloudFront after updating `ads.txt` or `index.html`.
- Enabling **Auto ads** and **manual units** without planning layout—test on mobile.
- **Privacy policy** still saying “no third-party ads” after enabling AdSense.

---

## G) Platform cutover — `tools.neonema.com` (P3.6)

After JSON and RevealIP move under the unified hub, update Google properties so ads and search indexing follow the new hostname.

### Repo / deploy (before dashboard work)

| File | Purpose |
|------|---------|
| `apps/hub/public/ads.txt` | **Required** at `https://tools.neonema.com/ads.txt` (hub deploy root) |
| `apps/json/public/ads.txt` | Optional duplicate at `/json/ads.txt` (legacy per-app path) |
| `apps/revealip/public/ads.txt` | Optional duplicate at `/revealip/ads.txt` |

Deploy hub `ads.txt` with platform build:

```bash
npm run build
test -f dist/ads.txt && cat dist/ads.txt
npm run deploy -- platform
```

Verify:

```bash
curl -sI "https://tools.neonema.com/ads.txt" | grep -iE "HTTP/|content-type:"
curl -s "https://tools.neonema.com/ads.txt"
```

Expected: **HTTP 200**, `content-type: text/plain`, publisher line present.

### Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console).
2. **Add property** → **URL prefix** `https://tools.neonema.com` (or **Domain** `tools.neonema.com` if you prefer DNS verification).
3. Verify ownership (HTML file upload, DNS TXT in Cloudflare, or Google Analytics — use whichever matches your setup).
4. **Sitemap:** this repo does not ship a `sitemap.xml`. Skip unless you add one later at `https://tools.neonema.com/sitemap.xml`.
5. **Legacy properties** (`json-neonema.com`, `revealip-neonema.com`): leave in place during redirect soak, or use **Change of address** to `tools.neonema.com` if both properties are verified. Apex **301** redirects already send users and most crawlers to the hub.
6. Optional: **URL Inspection** → request indexing for `https://tools.neonema.com/#/json` and `https://tools.neonema.com/#/revealip` (hash URLs may index inconsistently; hub root is the primary property).

### Google AdSense

1. Open [Google AdSense](https://www.google.com/adsense/) → **Sites**.
2. **Add site** `tools.neonema.com` if not already listed.
3. Confirm **ads.txt** status is **Authorized** for `tools.neonema.com` (requires root `ads.txt` deploy above).
4. Legacy sites (`json-neonema.com`, `revealip-neonema.com`): **do not remove immediately**. After the 30-day redirect soak (P3.8), remove or archive them from the site list if AdSense still shows them as separate properties.
5. Ad units remain in tool `index.html` files (`apps/json/public/`, `apps/revealip/public/`). No hub-level ad script is required — ads load inside hub iframes.

### Ad serving smoke test (manual)

In incognito, with ad blockers disabled:

1. `https://tools.neonema.com/#/json` — JSON tab loads; no console errors from `adsbygoogle.js`; ad slot or Auto ads render if enabled in your account.
2. `https://tools.neonema.com/#/revealip` — same for RevealIP.
3. AdSense → **Policy center** / **Site management** — no new crawl or `ads.txt` errors for `tools.neonema.com`.

### P3.6 sign-off checklist

- [x] `https://tools.neonema.com/ads.txt` returns **200**
- [ ] Search Console property for `tools.neonema.com` verified (optional if focusing on utility traffic only)
- [ ] AdSense lists `tools.neonema.com` with authorized `ads.txt` (optional — **AdSense removal is platform backlog**; sites are not monetized)
- [ ] No ad-serving errors on JSON and RevealIP hub tabs
- [ ] Legacy AdSense / GSC properties noted for post-soak cleanup (P3.8)

**Backlog:** strip all AdSense code and `ads.txt` when scheduled — see [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md#remove-adsense-backlog).
