# AWS UI Step-by-Step (S3 + CloudFront)

This guide matches the pattern used for NeoNema static utilities: a **private S3 bucket** as the origin, **CloudFront** in front with **Origin Access Control (OAC)**, and optional **custom domain + ACM**.

In this monorepo, upload from `apps/<app-name>/public/` (for example `apps/json/public/` or `apps/revealip/public/`). Most apps are fully static. **RevealIP** also needs a CloudFront Function for `/api/ip` — see [revealip-cloudfront-function.md](./revealip-cloudfront-function.md).

**Console drift:** AWS moves CloudFront UI labels often. Section **C** follows the current **standard distribution** wizard and links to AWS’s own getting started page—use that page side-by-side if a button name differs in your account.

**Related docs:** after AWS is working, use [cloudflare-dns.md](./cloudflare-dns.md) to point your Cloudflare-managed domain at CloudFront, and [adsense.md](./adsense.md) if you run Google AdSense.

## Prerequisites

- AWS account with permissions for **S3**, **CloudFront**, and **ACM** (if using a custom domain).
- Ready-to-upload assets under `apps/<app-name>/public/` in this monorepo.
- A globally unique S3 bucket name (for example `json-neonema-prod-site`).

## A) Create S3 bucket (static origin)

1. Open AWS Console → **S3** → **Create bucket**.
2. **Bucket name**: choose a globally unique name.
3. **Region**: your preferred region (CloudFront is global; this only affects where objects are stored).
4. Keep **Block all public access** **ON**. CloudFront reads objects via **OAC** (signed/authorized access), not public bucket ACLs.
5. **Object Ownership**: default (ACLs disabled) is fine for this pattern.
6. Create the bucket.

## B) Upload site files

1. Open the bucket → **Upload**.
2. Upload **the contents** of `apps/<app-name>/public/` (the files themselves), not the `public` folder wrapper. The object key for the homepage must be **`index.html`** at the **bucket root** (not `public/index.html`).
3. Confirm objects exist (at minimum):

   - `index.html`
   - `app.js`
   - `styles.css`
   - `brand-tokens.css`
   - `privacy-policy.html`
   - `terms.html`
   - `Product.png`
   - `NeoNema.png`

4. **Content-Type**: If the browser downloads a file instead of rendering it, edit the object in S3 → **Metadata** → **Content-Type** (for example `text/html` for `.html`, `text/css` for `.css`, `application/javascript` for `.js`).

## C) Create CloudFront distribution (current console)

AWS has replaced the old “single-page” CloudFront form with a **wizard** in the **CloudFront v4** console. If labels in your account differ slightly, use the official walkthrough (same flow): [Get started with a CloudFront standard distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html).

**Open the console:** [https://console.aws.amazon.com/cloudfront/v4/home](https://console.aws.amazon.com/cloudfront/v4/home)

### C1) Wizard: S3 + recommended settings (easiest; sets up OAC)

Use this when you see **Create distribution** and a multi-step flow (distribution name → use case → origin → security).

1. In the left sidebar, choose **Distributions**.
2. Choose **Create distribution**.
3. **Distribution name** (optional): any label you like (stored as a tag).
4. For **Use case** / **Get started**, choose **Single website or app** → **Next**.
5. Choose **Next** again if the console shows an intermediate step with no changes needed.
6. **Origin type**: choose **Amazon S3**.
7. **S3 origin**: choose **Browse S3** and select the **same bucket** you uploaded files to (general-purpose bucket; **not** “website hosting” endpoint).
8. **Settings**: choose **Use recommended origin settings**.  
   This applies CloudFront’s template for S3, including **Origin Access Control (OAC)** and (when you finish) can **update the S3 bucket policy** so only this distribution can read objects.
9. Choose **Next**.
10. **Enable security protections**: turn **AWS WAF** on or off (optional for a small static site).
11. Choose **Next**.
12. Choose **Create distribution**.

After creation, open the new distribution and wait until it finishes **Deploying** (status / last modified updates).

13. Copy **Distribution domain name** (e.g. `d111111abcdef8.cloudfront.net`). Test:  
    `https://YOUR_DOMAIN.cloudfront.net/index.html` first (confirms OAC + bucket policy).  
14. **Required for `/`:** CloudFront does **not** infer a homepage by itself. If `https://YOUR_DOMAIN.cloudfront.net/` returns **403** or **MissingKey** while `/index.html` works, you must set **Default root object** to `index.html` (see **C3**). S3 REST origins have no “index document” setting—that behavior is **only** from this CloudFront field.

### C2) If you do *not* see “Single website or app” (manual OAC)

Some accounts or older entry points still use screens titled **Specify origin**, **Get started**, or **Customize origin settings**.

- **Pick S3**: origin type **Amazon S3**, choose your bucket (REST-style origin, not website endpoint if you want OAC).
- **Origin access**: **Origin access control settings (recommended)** → create or select an **Origin access control** (OAC) for **S3**, signing **SigV4** / **Sign requests (recommended)**.
- **Bucket policy**: after saving, use the console’s **Copy policy** / **Update S3 bucket policy** prompt, or add the policy manually so `cloudfront.amazonaws.com` can `s3:GetObject` with a condition on your **distribution ARN** (see [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)).
- **Create OAC ahead of time** (if needed): left sidebar → **Origin access** (under **Security**) → **Create control setting** → origin type **S3** → create, then attach it on the origin’s **Edit** screen.

Preconfigured behavior/cache names (e.g. **CachingOptimized**) live in the [Preconfigured distribution settings reference](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/template-preconfigured-origin-settings.html)—you only need them if you choose **Customize origin settings** instead of **Use recommended origin settings**.

### C3) Default root object (`/` → `index.html`) — set this explicitly

**Symptom:** `/index.html` works but `https://dxxxx.cloudfront.net/` does not (403, access error, or empty). **Cause:** **Default root object** is blank.

The standard-distribution wizard often leaves this empty until you edit the distribution. Set it on the **distribution** (not on the S3 bucket).

1. **CloudFront** → **Distributions** → open your distribution.
2. Choose **Settings** (or **General**), then **Edit** on the settings panel—*or* use the **Details** summary if it shows **Default root object** with an **Edit** link.
3. Find **Default root object** (sometimes under “Standard logging” / other options on the same edit screen).
4. Enter exactly: **`index.html`** (no leading slash).
5. **Save changes** and wait until the distribution finishes **Deploying**.

Then verify:

- `https://dxxxx.cloudfront.net/` serves the same page as `/index.html`.

If the console moved the field, use the distribution search box or see [Values that you specify when you create or update a distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesDefaultRootObject).

### C4) Where things live after creation (navigation cheat sheet)

| Task | Where to look |
|------|----------------|
| Domain name, deploy status | **Distributions** → select distribution → **Details** |
| Change **Default root object**, custom domain | Distribution → **Settings** / **General** (tab names vary)—**not** the **Behaviors** tab |
| **Invalidations** | Same distribution → **Invalidations** tab |
| Edit **origin** / OAC | **Origins** tab → select origin → **Edit** |
| Path routing, cache policy per URL | **Behaviors** tab (see **C5**) |
| **Error pages** (optional) | **Error pages** / **Custom error responses** tab |

### C5) Behaviors tab — you usually *do not* change this for `/` → `index.html`

A typical static site has **one** behavior:

| Precedence | Path pattern | Notes |
|------------|--------------|--------|
| **0** | **Default (`*`)** | Correct: all paths go to your S3 origin. |

Your row (**Redirect HTTP to HTTPS**, **Managed-CachingOptimized**, S3 origin) is **fine**. That does **not** control the homepage file name.

- **Default root object** = `index.html` → set under **Settings** / **General** (distribution edit), as in **C3**.
- **Behaviors** = which **origin** and **cache rules** apply for each **path pattern**. You only add more behaviors if you need another origin (e.g. `/api/*` elsewhere) or different caching per path.

Do **not** create a separate behavior just to “set index.html”; that is the wrong place and will not fix `/` the way **Default root object** does.

### Custom error responses (optional)

For this static site, **separate HTML files** (`privacy-policy.html`, `terms.html`) are served as real objects. You usually **do not** need a SPA-style “404 → index.html” rule unless you later move to client-side routing only. If requests for unknown paths should show a friendly page, add **Error pages** (for example 403/404) in the distribution settings and point to a custom HTML key in the bucket.

## D) Custom domain + TLS (ACM)

TLS certificates used **on CloudFront** must be in **ACM `us-east-1` (N. Virginia)**, even if the S3 bucket is in another region.

1. Open **AWS Certificate Manager** in **`us-east-1`**.
2. **Request** a public certificate. Include the exact hostnames you will use (for example `json.example.com`, or `example.com` and `www.example.com` if you need both).
3. **Validate** with **DNS validation**. AWS gives you **CNAME** name/value pairs to create at your DNS provider.
   - If the domain uses **Cloudflare**, add those records in the Cloudflare DNS dashboard (see [cloudflare-dns.md](./cloudflare-dns.md)). Use the **exact** names/values ACM shows; for validation records, **DNS only** (grey cloud) is often simplest until validation completes.
4. When the certificate shows **Issued**, open the CloudFront distribution → **Settings** (or **General**) → **Edit**:
   - Add **Custom domain** / **Alternate domain name (CNAME)** entries that **exactly match** the certificate (e.g. `json.example.com`).
   - Under **Custom SSL certificate** / **TLS certificate**, choose the **ACM** certificate from **`us-east-1`**.
5. Save and wait for the distribution to finish deploying.

   If you cannot find these fields, search the distribution page for **“custom domain”** or see [Use custom URLs with CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html).

## E) Validate the site

1. Open the **CloudFront domain**: `https://dxxxxxxxxxxxx.cloudfront.net` (**root `/`**, not only `/index.html`).
2. Verify:
   - **`/`** loads the app (if not, set **Default root object** to `index.html` per **C3**).
   - `/privacy-policy.html` and `/terms.html` load.
   - Static assets return **200** (check **Network** in browser devtools).
3. After attaching a custom domain, test `https://your-hostname` the same way (after DNS points at CloudFront—see Cloudflare doc).

## Troubleshooting: Browser shows XML `AccessDenied` / `Access Denied`

That response is **S3’s XML error body**, usually returned when CloudFront asks S3 for an object but **S3 rejects the request**. Typical causes:

### 1) Confirm the URL

Use **`https://` + your CloudFront distribution domain** (ends in **`cloudfront.net`**), for example:

`https://d111111abcdef8.cloudfront.net/index.html`

If you open the **S3 object URL** or **`https://BUCKET.s3...amazonaws.com/...`** directly while the bucket is private, you can also see **`AccessDenied`** XML—that is expected. Only CloudFront (with OAC + bucket policy) should read the bucket.

### 2) Fix the S3 bucket policy (most common)

With **Origin Access Control (OAC)**, the bucket must allow the **CloudFront service principal** to `s3:GetObject` **only for your distribution**.

1. **CloudFront** → **Distributions** → open your distribution → copy **Distribution ID** (e.g. `E1234ABCD5678`).
2. Note your **AWS account ID** (support center or top-right account menu).
3. **S3** → your bucket → **Permissions** → **Bucket policy**.

You need a statement like this (replace placeholders):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

- **`AWS:SourceArn`** must match **this** distribution exactly. If you recreated the distribution, update the policy with the **new** distribution ID.
- **`Resource`** must be `arn:aws:s3:::BUCKET/*` (all objects you serve).

**Easier:** In **CloudFront** → your distribution → **Origins** → select the S3 origin → **Edit**. If the console offers to **update** or **copy** the bucket policy for OAC, use that and paste/save it on the bucket.

### 3) Confirm the origin uses OAC

**CloudFront** → distribution → **Origins** → **Edit** the S3 origin:

- **Origin access** should be **Origin access control** (not “public” / not missing).
- An **Origin access control** name should be selected.

If OAC was never attached, attach it and then fix the **bucket policy** as above.

### 4) Confirm objects exist at the path you request

In **S3**, verify **`index.html`** exists at the **bucket root** (not only under a folder like `public/`). Try:

`https://YOUR_DISTRIBUTION.cloudfront.net/index.html`

If that works but **`/`** fails, set **Default root object** to `index.html` (see section **C3**).

### 5) After policy changes

Wait a minute, then hard-refresh or open an incognito window. Optionally create an **invalidation** for `/*` if you still see an old error.

Official reference: [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## F) Deploy updates

1. Upload changed files to S3 (same keys; overwrite).
2. Create a **CloudFront invalidation** for changed paths (for example `/index.html`, `/app.js`, `/styles.css`) or `/*` for a full refresh. Otherwise viewers may see cached old files.

## Common mistakes to avoid

- Using an **old CloudFront console URL** or bookmark: open **`/cloudfront/v4/home`** (see section C). The legacy UI listed fields like “Default cache behavior” on one long page; the v4 wizard splits them across steps or hides them inside **recommended origin settings**.
- Uploading under a prefix like `public/index.html` so the site root is wrong.
- Missing **bucket policy** for **OAC** → **403** from CloudFront.
- **Default root object** left blank → **`/`** fails even though **`/index.html`** works (very common after the v4 wizard; fix in **C3**).
- ACM for CloudFront not in **`us-east-1`**.
- Hostname on the certificate not matching the distribution’s **custom / alternate domain** list.
- Forgetting **invalidation** after deploys when cache TTLs are long.

## Difference from `revealip-neonema`

The **revealip** project adds a **CloudFront Function** and a separate **behavior** for `/api/ip`. **This repo** needs only the default behavior serving S3 unless you add APIs or edge logic later.
