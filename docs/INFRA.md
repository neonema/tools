# Infrastructure

AWS accounts, credentials, DNS, and the notes you would need to rebuild the stack.

---

## Two-account model

NeoNema uses **two separate AWS accounts** — one per product boundary. DNS (Cloudflare) sits outside AWS and routes each hostname to the right CloudFront distribution.

| AWS account | Hostnames | Repo | This repo? |
|-------------|-----------|------|------------|
| **NeoNema tools** | `tools.neonema.com` | `neonema-tools` | **Yes** — all deploy automation here |
| **NeoNema company** | `neonema.com` (+ `www` if used) | Separate company-site repo | **No** |

Each account is self-contained: **private S3 bucket → CloudFront (OAC) → ACM cert in us-east-1 → IAM deploy role**. No cross-account S3 origins.

**Why two accounts:** blast-radius isolation (a tools deploy cannot touch the company site), separate IAM per repo, and a clean boundary as `neonema.com` grows.

## Tools account layout

```
NeoNema tools AWS account          (local CLI: --profile neonema-tools)
├── S3: neonema-tools-prod                   (private, OAC-only)
├── CloudFront: EGT0I63QAM75Z                (tools.neonema.com)
├── ACM (us-east-1): tools.neonema.com
├── CloudFront Function: revealip-ip-api     (/api/ip)
├── CloudFront Function: tools-uri-rewrite   (directory URLs)
└── IAM: github-neonema-tools-deploy         (GitHub OIDC — deploy on push to main)
```

The IAM trust policy and permissions are checked in under [`infra/iam/`](../infra/iam/). There is no Terraform or CDK — the stack is small enough that Console setup plus those policy documents is proportionate. See [STATUS.md](./STATUS.md).

## Credentials

**CI:** GitHub Actions assumes `github-neonema-tools-deploy` via OIDC. No long-lived keys anywhere, no AWS secrets in the repo or in GitHub. Permissions are scoped to the prod bucket, CloudFront invalidation, and function publish.

**Local:** deploys use the **`neonema-tools`** CLI profile.

```bash
aws configure --profile neonema-tools
# Default region: us-east-1
# Output format:  json

aws sts get-caller-identity --profile neonema-tools   # verify the account
```

Set `awsProfile` to `"neonema-tools"` in `deploy.config.json`. Deploy scripts pass `--profile` to the AWS CLI automatically when the field is set.

---

## DNS (Cloudflare)

| Record | Type | Target | Proxy |
|--------|------|--------|-------|
| `tools` (in `neonema.com`) | CNAME | CloudFront distribution domain (`d….cloudfront.net`) | Proxied |
| ACM validation records | CNAME | Value ACM shows (`…acm-validations.aws.`) | DNS only |

With the orange cloud on, set **SSL/TLS → Overview** to **Full (strict)** so Cloudflare validates CloudFront's certificate. Never use Flexible — CloudFront always speaks HTTPS.

Cloudflare may cache HTML at the edge when proxied; CloudFront invalidation only clears the origin side. If a deploy looks stale in the browser but correct via `curl` against the distribution domain, purge Cloudflare too.

**Never point a site hostname at `*.s3.*.amazonaws.com`** — a private bucket returns `AccessDenied` XML to the browser. The traffic record always targets the CloudFront domain.

### Legacy domains

`json-neonema.com` and `revealip-neonema.com` (plus `www`) are redirect-only. Their old AWS accounts are closed; Cloudflare Redirect Rules do all the work:

| Zone | Match | Action |
|------|-------|--------|
| `json-neonema.com` | `(http.host eq "json-neonema.com") or (http.host eq "www.json-neonema.com")` | 301 → `https://tools.neonema.com/json/` |
| `revealip-neonema.com` | `(http.host eq "revealip-neonema.com") or (http.host eq "www.revealip-neonema.com")` | 301 → `https://tools.neonema.com/revealip/` |

Query strings are not preserved; all legacy paths collapse to the tool's path URL. Each zone needs a proxied `www` CNAME to the apex for the `www` variants to resolve. Update the Cloudflare Redirect Rules if they still point at `/#/...`.

```bash
for host in json-neonema.com www.json-neonema.com revealip-neonema.com www.revealip-neonema.com; do
  echo "=== $host ==="; curl -sI "https://$host/" | grep -iE "HTTP/|location:"
done
```

---

## Rebuilding the stack

You should not need this, but these are the parts that are easy to get wrong.

**S3:** private bucket, Block all public access **on**, no public bucket policy. CloudFront reads it via OAC only. Upload objects at the bucket root — a `public/` prefix breaks every path.

**CloudFront origin:** use the S3 **REST** origin (not the website endpoint) with **Origin Access Control**, then apply the bucket policy the console offers. Without it, CloudFront gets 403 from S3 and the browser sees `AccessDenied` XML:

```json
{
  "Sid": "AllowCloudFrontServicePrincipalReadOnly",
  "Effect": "Allow",
  "Principal": { "Service": "cloudfront.amazonaws.com" },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::neonema-tools-prod/*",
  "Condition": {
    "StringEquals": {
      "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
    }
  }
}
```

`AWS:SourceArn` must match the current distribution — recreating the distribution invalidates it.

**Default root object:** set it to `index.html` on the distribution (Settings/General, *not* Behaviors). S3 REST origins have no index-document concept, so `/` returns 403 while `/index.html` works until this field is set. Deeper directory URLs are handled by `tools-uri-rewrite`, not by this setting.

**ACM:** the certificate must live in **us-east-1** regardless of bucket region, and every hostname on the distribution's alternate domain names must appear on the cert.

**Behaviors:** `/api/ip*` must rank above the default `*`. See [DEPLOY.md](./DEPLOY.md#edge-functions) for both function attachments.

### `AccessDenied` XML in the browser — the usual causes

1. DNS points at S3 instead of CloudFront
2. Bucket policy missing or its `SourceArn` names an old distribution
3. Origin has no OAC attached
4. Object genuinely missing at that key
5. `/` fails but `/index.html` works → default root object is blank
