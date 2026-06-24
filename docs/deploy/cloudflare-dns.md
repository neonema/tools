# Cloudflare Step-by-Step (Domain + DNS to CloudFront)

Use this when your **domain is registered or managed in Cloudflare** and your site is served from **AWS CloudFront** (S3 origin), as in [aws-s3-cloudfront.md](./aws-s3-cloudfront.md).

## What you are wiring up

- **Visitors** → **Cloudflare DNS** (your hostname) → **CloudFront** (TLS from ACM) → **S3** (private bucket via OAC).

You will create DNS records that send traffic for your chosen hostname (for example `json.example.com`) to your **CloudFront distribution domain name** (for example `d111111abcdef8.cloudfront.net`).

## Two different kinds of DNS records (do not mix them up)

| Purpose | What it looks like in Cloudflare | Where it must point |
|--------|-----------------------------------|---------------------|
| **ACM certificate validation** | Often **two** records whose **Name** starts with `_` (for example `_abc123def.example.com`) | The **target** ACM shows (often `...acm-validations.aws.`) |
| **Real website traffic** | The hostname users type (for example `json` or `www`) | **`dxxxxxxxx.cloudfront.net`** only |

The **validation** records only prove to AWS that you own the domain. They **do not** turn your domain into a website by themselves.

You must **also** add the **traffic** CNAME from section **C** (subdomain → CloudFront). If the **traffic** record is missing, wrong, or points at **S3** instead of **CloudFront**, you can get errors when opening the site.

**Never** point your public site hostname at **`your-bucket.s3.us-east-1.amazonaws.com`** (or any `*.s3.*.amazonaws.com` URL). That is the **S3 REST endpoint**; a **private** bucket returns **`AccessDenied`** XML to the browser. Always use **`xxxxxxxx.cloudfront.net`** for the CNAME target.

## A) Collect values from AWS

1. **CloudFront** → your distribution → copy:
   - **Distribution domain name** (ends in `.cloudfront.net`).
2. If you use a **custom hostname** on CloudFront, that same name must appear on the **ACM certificate** attached to the distribution and under **Alternate domain name (CNAME)** on the distribution.

## B) ACM DNS validation (if the certificate is not issued yet)

1. In **ACM (`us-east-1`)**, open your pending certificate → note each **CNAME name** and **CNAME value** for validation.
2. In **Cloudflare** → your zone → **DNS** → **Add record**:
   - **Type**: `CNAME`
   - **Name**: the **left-hand** part ACM shows (often something like `_abc123.example.com` or a subdomain ACM specifies—paste exactly; Cloudflare may auto-shorten the zone suffix).
   - **Target**: the **value** ACM provides (often ends with `acm-validations.aws.` or similar).
   - **Proxy status**: **DNS only** (grey cloud) for validation records is a common choice to avoid extra caching/proxy behavior during validation.
3. Wait until ACM shows **Issued**.

## C) Point your site hostname at CloudFront

### Subdomain (recommended): `json.example.com`

1. Cloudflare → **DNS** → **Add record**:
   - **Type**: `CNAME`
   - **Name**: your subdomain (for example `json` for `json.example.com`).
   - **Target**: your CloudFront **distribution domain name** (for example `d111111abcdef8.cloudfront.net`).
   - **Proxy status**:
     - **Proxied** (orange cloud): traffic goes through Cloudflare’s network (WAF, caching rules, “Always Use HTTPS,” etc.). Set **SSL/TLS** → **Overview** to **Full (strict)** so Cloudflare connects to CloudFront over HTTPS with a valid certificate.
     - **DNS only** (grey cloud): DNS resolves directly to CloudFront; simpler stack, fewer Cloudflare features in front. Still HTTPS to viewers if CloudFront serves HTTPS (it should).

2. Save. DNS propagation can take a few minutes to hours.

### Apex domain: `example.com`

You cannot use a plain **CNAME** at the zone apex under classic DNS. Options:

- Use **Cloudflare CNAME flattening**: create a **CNAME** for `@` pointing to the `*.cloudfront.net` hostname (Cloudflare flattens it at resolution time), or use the **CNAME** setup the Cloudflare UI allows for the root.
- Alternatively, use **AWS Route 53** ALIAS to CloudFront for the apex (different provider) — not covered here if you stay all-in on Cloudflare DNS.

Pick one hostname strategy (apex vs `www` vs subdomain) and keep **ACM + CloudFront alternate names** aligned.

## D) SSL/TLS settings when using orange cloud (proxied)

1. **SSL/TLS** → **Overview**: prefer **Full (strict)** so Cloudflare validates CloudFront’s certificate.
2. **Edge Certificates**: enable **Always Use HTTPS** if you want HTTP upgraded to HTTPS at Cloudflare.
3. Avoid **Flexible** SSL (that mode is for origins that only speak HTTP; CloudFront should always be **HTTPS**).

## E) Verify

1. `https://your-hostname` loads the same site as `https://dxxxx.cloudfront.net`.
2. Certificate in the browser shows a valid chain (either Cloudflare’s cert when proxied, or ACM’s when DNS-only—depending on mode).
3. No redirect loops (if you see loops, check **SSL/TLS** mode and Page Rules / Redirect Rules).

## F) Optional Cloudflare features

- **Caching**: Cloudflare may cache HTML at the edge when proxied. For frequently updated static sites, consider **Cache Rules** to bypass cache for HTML or use short TTLs; you still rely on **CloudFront invalidation** for origin updates.
- **Security**: **WAF**, **Bot Fight Mode**, etc.—test after enabling so you do not block legitimate users or Google’s crawlers (relevant for AdSense).
- **ads.txt** and crawler access: ensure firewall rules do not block **Googlebot** or AdSense verification requests (see [`ADSENSE_STEP_BY_STEP.md`](ADSENSE_STEP_BY_STEP.md)).

## Common mistakes

- **CNAME target** typo (wrong distribution domain).
- **Orange cloud** + wrong **SSL/TLS** mode → 525/526-style errors or loops.
- **Hostname** not listed on the **ACM cert** and CloudFront **alternate domain names**.
- **Duplicate DNS** records for the same name (remove old A/AAAA records pointing elsewhere).
- **Only** the two ACM validation CNAMEs exist—**no** record sending `www` / your app hostname → **`dxxxx.cloudfront.net`**.
- **Traffic** CNAME points to **S3** (`*.s3.*.amazonaws.com`) instead of **CloudFront** → XML **`AccessDenied`**.

## Troubleshooting: `AccessDenied` XML when opening your domain

That XML is **from S3**, not from CloudFront’s HTML error page. Common causes when using Cloudflare:

1. **Site hostname points at S3**  
   In **Cloudflare → DNS**, find the record for the name you type in the browser (e.g. `www`, `json`, or `@`).  
   - **Target must be** `dxxxxxxxx.cloudfront.net`.  
   - If the target is your **bucket** name or anything under **`s3.amazonaws.com`**, change it to the **CloudFront distribution domain**.

2. **Traffic record missing**  
   You added only **ACM** validation records. Add a **separate** CNAME (section **C**) for the real hostname → CloudFront.

3. **CloudFront not finished with custom domain**  
   In **CloudFront**, confirm **Alternate domain names** lists your hostname and a valid **ACM** certificate is attached, and the distribution is **Deployed**. Then test `https://dxxxx.cloudfront.net/` again; if that works but the custom name still fails, the problem is almost always **DNS** (wrong target or propagation).

4. **Conflicting records**  
   Remove extra **A** / **AAAA** / **CNAME** for the same name that point somewhere else.

After fixing DNS, wait a few minutes and use an incognito window or `dig` / online DNS checker to confirm the hostname resolves to **CloudFront** (you’ll see the query ultimately tied to **`cloudfront.net`**), not **`amazonaws.com`** S3 hosts.
