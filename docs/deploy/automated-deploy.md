# Automated Deploy

Production deploys run from **GitHub Actions** on push to `main` (or on demand). Local scripts remain the fallback when you need to deploy from your machine.

**Target model:** build `dist/` with `npm run build`, then sync to the unified `tools.neonema.com` bucket. See [platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md).

## Production deploy (CI — primary)

Merging to `main` triggers [`.github/workflows/deploy-prod.yml`](../../.github/workflows/deploy-prod.yml):

1. `npm run brand:check`
2. `npm run test:json-converters`
3. `npm run build`
4. Assume AWS role via **OIDC** (no long-lived keys in GitHub secrets)
5. `npm run deploy -- platform` using [`deploy.config.prod.json`](../../deploy.config.prod.json)

### On-demand redeploy

Use **Actions → Deploy prod → Run workflow** (or `gh workflow run deploy-prod.yml`) to redeploy without an empty commit. Run from the `main` branch so OIDC trust matches the deploy role.

### Monitor a run

```bash
gh run list --workflow=deploy-prod.yml --limit 5
gh run watch
```

### CI config (not secrets)

| File | In git? | Purpose |
|------|---------|---------|
| `deploy.config.prod.json` | Yes | Prod bucket, distribution ID, region, invalidation paths |
| `infra/iam/github-neonema-tools-deploy-*.json` | Yes | OIDC trust + IAM policy reference |

CI uses role `arn:aws:iam::029727239472:role/github-neonema-tools-deploy`. No `awsProfile` in `deploy.config.prod.json` — OIDC supplies credentials.

See [infra/README.md](../infra/README.md) for the two-account model and OIDC setup (P5).

## Local deploy (fallback)

Use when CI is unavailable or you need a dry-run before merge.

### Prerequisites

1. [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed.
2. **NeoNema tools AWS account** credentials via the **`neonema-tools`** profile (see [infra/README.md](../infra/README.md)):
   ```bash
   aws configure --profile neonema-tools
   aws sts get-caller-identity --profile neonema-tools   # verify tools account
   ```
3. IAM permissions for platform deploy: `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject` (if using sync delete), `cloudfront:CreateInvalidation`. RevealIP edge deploys also need `cloudfront:DescribeFunction`, `cloudfront:UpdateFunction`, `cloudfront:PublishFunction`.

### Setup

```bash
cp deploy.config.example.json deploy.config.json
```

Edit `deploy.config.json` with your real values. This file is gitignored.

### Platform deploy

```bash
npm run build
npm run deploy -- platform --dry-run
npm run deploy -- platform
```

The `platform` entry in `deploy.config.json` should set `"awsProfile": "neonema-tools"`.

Or point at the committed prod config (uses ambient AWS credentials, not a profile):

```bash
npm run build
DEPLOY_CONFIG=deploy.config.prod.json npm run deploy -- platform --dry-run
DEPLOY_CONFIG=deploy.config.prod.json npm run deploy -- platform
```

### Other deploy commands

```bash
# Per-app sync (legacy / interim buckets)
npm run deploy -- json --dry-run
npm run deploy -- json
npm run deploy -- revealip

# Sync only (skip invalidation)
npm run deploy -- json --no-invalidate

# RevealIP: publish CloudFront Function after editing ip-api-function.js
npm run deploy:edge -- revealip
```

## Config fields (not secrets)

| Field | What to provide |
|-------|-----------------|
| `s3Bucket` | S3 bucket name (from AWS Console → S3) |
| `s3Region` | Bucket region (e.g. `us-east-1`) |
| `cloudfrontDistributionId` | Distribution ID starting with `E` (CloudFront → Distributions) |
| `awsProfile` | Local only — CLI profile for the **NeoNema tools account** (`neonema-tools`) |
| `s3SyncDelete` | `true` removes S3 objects not in local `public/` — use with care |
| `invalidatePaths` | Usually `["/*"]` |
| `edge.cloudfrontFunctionName` | RevealIP only — function name in CloudFront → Functions |

Find distribution ID: **CloudFront** → **Distributions** → copy **ID** column.

## Legacy per-app deploy (interim)

During migration, RevealIP and JSON may still live in **legacy per-app AWS accounts**. Use a different `awsProfile` per interim app entry in `deploy.config.json` until cutover completes. After cutover, all deploys use **`neonema-tools`** in the NeoNema tools account only.

## What is NOT required in the repo

- AWS access keys or secret tokens
- GitHub secrets for production deploy (OIDC replaces static keys)
- AdSense or Cloudflare tokens

## Full RevealIP release

1. `npm run brand:check`
2. Merge to `main` (CI deploy) or `npm run deploy -- platform` locally
3. If `cloudfront/ip-api-function.js` changed: `npm run deploy:edge -- revealip` (local; not in CI workflow yet)
4. Run [device-test-checklist.md](./device-test-checklist.md) against production
