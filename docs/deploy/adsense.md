# Google AdSense Step-by-Step (Static site on S3 + CloudFront + Cloudflare)

This complements [aws-s3-cloudfront.md](./aws-s3-cloudfront.md) and [cloudflare-dns.md](./cloudflare-dns.md). AdSense policies and product flows change over time; always confirm details in [Google’s AdSense Help](https://support.google.com/adsense/) and your AdSense account.

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
