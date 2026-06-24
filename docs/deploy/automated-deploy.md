# Automated Deploy (Phase 3)

Local deploy scripts sync each app's `public/` folder to S3 and invalidate CloudFront. No AWS credentials are stored in this repo.

## Prerequisites

1. [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed.
2. Credentials configured locally — one of:
   - `aws configure` (default profile)
   - Named profiles per app (`aws configure --profile revealip`)
3. IAM permissions for each app: `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject` (if using sync delete), `cloudfront:CreateInvalidation`. RevealIP edge deploys also need `cloudfront:DescribeFunction`, `cloudfront:UpdateFunction`, `cloudfront:PublishFunction`.

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
| `awsProfile` | Optional CLI profile name if not using default credentials |
| `s3SyncDelete` | `true` removes S3 objects not in local `public/` — use with care |
| `invalidatePaths` | Usually `["/*"]` |
| `edge.cloudfrontFunctionName` | RevealIP only — function name in CloudFront → Functions |

Find distribution ID: **CloudFront** → **Distributions** → copy **ID** column.

## Separate AWS accounts today

RevealIP and JSON may still live in different AWS accounts. Use a different `awsProfile` per app in `deploy.config.json` — each profile points at the right account via `~/.aws/credentials`.

Account consolidation into NeoNema LLC is planned for Phase 4 (`docs/infra/`).

## What is NOT required in the repo

- AWS access keys or secret tokens
- GitHub secrets (unless you add CI deploy later)
- AdSense or Cloudflare tokens

## Optional: CI deploy (not included by default)

Push-to-deploy from GitHub would need either:

- **OIDC** (recommended): IAM role trusted by GitHub Actions — no long-lived keys
- **Repository secrets**: `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` per environment

Phase 3 ships local scripts only. Add CI deploy when accounts are consolidated or secrets are configured.

## Full RevealIP release

1. `npm run brand:check`
2. `npm run deploy -- revealip`
3. If `cloudfront/ip-api-function.js` changed: `npm run deploy:edge -- revealip`
4. Run [device-test-checklist.md](./device-test-checklist.md) against production
