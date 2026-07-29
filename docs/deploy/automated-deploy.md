# Automated Deploy

Production deploys run from **GitHub Actions** on push to `main` (or on demand). Local scripts remain the fallback when you need to deploy from your machine.

Build `dist/` with `npm run build`, then sync it to the `tools.neonema.com` bucket. See [platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md).

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

See [infra/README.md](../infra/README.md) for the two-account model and OIDC setup.

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
# Sync only (skip invalidation)
npm run deploy -- platform --no-invalidate

# Publish both CloudFront Functions after editing anything in apps/*/cloudfront/
npm run deploy:edge -- platform --dry-run
npm run deploy:edge -- platform
```

`deploy:edge` publishes every entry in the app's `edge` array: `revealip-ip-api` (`/api/ip`) and `tools-uri-rewrite` (directory URLs → hub hash routes).

## Config fields (not secrets)

| Field | What to provide |
|-------|-----------------|
| `s3Bucket` | S3 bucket name (from AWS Console → S3) |
| `s3Region` | Bucket region (e.g. `us-east-1`) |
| `cloudfrontDistributionId` | Distribution ID starting with `E` (CloudFront → Distributions) |
| `awsProfile` | Local only — CLI profile for the **NeoNema tools account** (`neonema-tools`) |
| `s3SyncDelete` | `true` removes S3 objects not in local `public/` — use with care |
| `invalidatePaths` | Usually `["/*"]` |
| `edge` | One object or an array of `{ cloudfrontFunctionName, functionSource }` — names must match CloudFront → Functions |

Find distribution ID: **CloudFront** → **Distributions** → copy **ID** column.

## What is NOT required in the repo

- AWS access keys or secret tokens
- GitHub secrets for production deploy (OIDC replaces static keys)
- Cloudflare tokens

## Full release

1. `npm run brand:check && npm run test:json-converters && npm run build`
2. Merge to `main` (CI deploy) or `npm run deploy -- platform` locally
3. If anything under `apps/*/cloudfront/` changed: `npm run deploy:edge -- platform` (local only — not in the CI workflow)
4. Run the device and accessibility pass in [platform/TOOL_CHECKLIST.md](../platform/TOOL_CHECKLIST.md) against production
