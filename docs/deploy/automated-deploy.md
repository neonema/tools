# Automated Deploy (Phase 3)

Local deploy scripts sync static assets to S3 and invalidate CloudFront. No AWS credentials are stored in this repo.

**Target model:** build `dist/` with `npm run build`, then `npm run deploy -- platform` to the unified `tools.neonema.com` bucket. See [platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md).

**Today:** per-app deploy (`npm run deploy -- json`, `npm run deploy -- revealip`) to separate buckets remains supported during migration.

## Prerequisites

1. [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed.
2. **NeoNema tools AWS account** credentials via the **`neonema-tools`** profile (see [infra/README.md](../infra/README.md)):
   ```bash
   aws configure --profile neonema-tools
   aws sts get-caller-identity --profile neonema-tools   # verify tools account
   ```
3. IAM permissions for platform deploy: `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject` (if using sync delete), `cloudfront:CreateInvalidation`. RevealIP edge deploys also need `cloudfront:DescribeFunction`, `cloudfront:UpdateFunction`, `cloudfront:PublishFunction`.

## Setup

```bash
cp deploy.config.example.json deploy.config.json
```

Edit `deploy.config.json` with your real values (see below). This file is gitignored.

## Deploy commands

```bash
# Dry-run (prints AWS commands without executing)
npm run deploy -- json --dry-run

# Sync public/ → S3 + CloudFront invalidation
npm run deploy -- json
npm run deploy -- revealip

# Sync only (skip invalidation)
npm run deploy -- json --no-invalidate

# RevealIP only: publish CloudFront Function after editing ip-api-function.js
npm run deploy:edge -- revealip
```

## Config fields (not secrets)

| Field | What to provide |
|-------|-----------------|
| `s3Bucket` | S3 bucket name (from AWS Console → S3) |
| `s3Region` | Bucket region (e.g. `us-east-1`) |
| `cloudfrontDistributionId` | Distribution ID starting with `E` (CloudFront → Distributions) |
| `awsProfile` | CLI profile for the **NeoNema tools account** — use `"neonema-tools"` (see [infra/README.md](../infra/README.md)) |
| `s3SyncDelete` | `true` removes S3 objects not in local `public/` — use with care |
| `invalidatePaths` | Usually `["/*"]` |
| `edge.cloudfrontFunctionName` | RevealIP only — function name in CloudFront → Functions |

Find distribution ID: **CloudFront** → **Distributions** → copy **ID** column.

## Platform deploy (target)

```bash
npm run build
npm run deploy -- platform --dry-run
npm run deploy -- platform
```

The `platform` entry in `deploy.config.json` should set `"awsProfile": "neonema-tools"`.

## Legacy per-app deploy (interim)

During migration, RevealIP and JSON may still live in **legacy per-app AWS accounts**. Use a different `awsProfile` per interim app entry in `deploy.config.json` until P1 cutover completes. After cutover, all deploys use **`neonema-tools`** in the NeoNema tools account only.

See [infra/README.md](../infra/README.md) for the two-account model and profile setup.

## What is NOT required in the repo

- AWS access keys or secret tokens
- GitHub secrets (unless you add CI deploy later)
- AdSense or Cloudflare tokens

## Optional: CI deploy (not included by default)

Push-to-deploy from GitHub would need either:

- **OIDC** (recommended): IAM role trusted by GitHub Actions — no long-lived keys
- **Repository secrets**: `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` per environment

Phase 3 ships local scripts only. Add CI deploy when the tools account OIDC role is configured (P5).

## Full RevealIP release

1. `npm run brand:check`
2. `npm run deploy -- revealip`
3. If `cloudfront/ip-api-function.js` changed: `npm run deploy:edge -- revealip`
4. Run [device-test-checklist.md](./device-test-checklist.md) against production
