# Deploy

Production deploys run from **GitHub Actions** on push to `main`. Local scripts are the fallback.

`npm run build` assembles `dist/` from the hub and every tool; deploying syncs that tree to the `tools.neonema.com` bucket and invalidates CloudFront. Model: [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## CI (primary)

Merging to `main` triggers [`.github/workflows/deploy-prod.yml`](../.github/workflows/deploy-prod.yml):

1. `npm run brand:check`
2. `npm run test:json-converters` and `npm run test:password`
3. `npm run build` (stamps every page with `GITHUB_SHA` and writes `version.json`)
4. Assume the AWS role via **OIDC** — no long-lived keys in GitHub secrets
5. `npm run deploy -- platform` using [`deploy.config.prod.json`](../deploy.config.prod.json)

Deploys run under the `production` concurrency group, so two pushes to `main` cannot sync at the same time. Actions are pinned to commit SHAs; Dependabot proposes bumps weekly.

**Public repo notes:** the OIDC trust policy names `repo:yuhahaha/neonema-tools:ref:refs/heads/main` only, and GitHub never issues an OIDC token to a workflow triggered by a pull request from a fork. Nothing a contributor pushes can deploy; only a merge to `main` does.

Any failing step blocks the deploy, so a red `brand:check` means nothing ships. Check runs after merging:

```bash
gh run list --workflow=deploy-prod.yml --limit 5
gh run watch
```

**On-demand redeploy:** Actions → Deploy prod → Run workflow, or `gh workflow run deploy-prod.yml`. Run it from `main` so OIDC trust matches the deploy role.

**CI config in git (not secrets):**

| File | Purpose |
|------|---------|
| `deploy.config.prod.json` | Prod bucket, distribution ID, region, invalidation paths, edge functions — also the template for local config |
| `infra/iam/github-neonema-tools-deploy-*.json` | OIDC trust policy + IAM permissions |

CI assumes `arn:aws:iam::029727239472:role/github-neonema-tools-deploy`. There is no `awsProfile` in the prod config — OIDC supplies credentials.

---

## Local deploy (fallback)

Use when CI is unavailable or you want a dry run before merging.

**Prerequisites:** AWS CLI v2, and the `neonema-tools` profile configured for the tools account — see [INFRA.md](./INFRA.md).

```bash
cp deploy.config.prod.json deploy.config.json   # once; gitignored
npm run build
npm run deploy -- platform --dry-run
npm run deploy -- platform
```

The two configs are identical except for one field: add `"awsProfile": "neonema-tools"` to the `platform` entry in `deploy.config.json` so the AWS CLI picks the right credentials. The prod config deliberately omits it — CI has ambient OIDC credentials and must not be handed a `--profile`. To deploy against the committed prod config directly:

```bash
DEPLOY_CONFIG=deploy.config.prod.json npm run deploy -- platform
```

Other flags:

```bash
npm run deploy -- platform --no-invalidate   # sync only
```

### Config fields (none are secrets)

| Field | What to provide |
|-------|-----------------|
| `source` | Directory to sync — `dist` for the platform |
| `s3Bucket` | Bucket name (AWS Console → S3) |
| `s3Region` | Bucket region, e.g. `us-east-1` |
| `cloudfrontDistributionId` | Distribution ID starting with `E` (CloudFront → Distributions) |
| `awsProfile` | Local only — CLI profile for the tools account |
| `s3SyncDelete` | `true` removes S3 objects missing locally — use with care |
| `invalidatePaths` | Usually `["/*"]` |
| `edge` | One object or an array of `{ cloudfrontFunctionName, functionSource }` |

Never required in this repo: AWS access keys, GitHub deploy secrets, Cloudflare tokens.

---

## Edge functions

Two CloudFront Functions run on the distribution. What they do: [ARCHITECTURE.md](./ARCHITECTURE.md#edge-functions).

| Function | Source |
|----------|--------|
| `revealip-ip-api` | `apps/revealip/cloudfront/ip-api-function.js` |
| `tools-uri-rewrite` | `apps/hub/cloudfront/uri-rewrite-function.js` |

**They are not deployed by CI.** After editing anything under `apps/*/cloudfront/`, publish them yourself:

```bash
npm run deploy:edge -- platform --dry-run
npm run deploy:edge -- platform
```

This publishes every entry in the `edge` array. A stale published version fails silently — the site keeps serving the old behavior — so verify:

```bash
curl -s  "https://tools.neonema.com/api/ip"                              # JSON with ipv4/ipv6/preferred
curl -sI "https://tools.neonema.com/json/" | grep -iE "HTTP/|location:"  # expect 200 (no Location)
curl -s  "https://tools.neonema.com/sitemap.xml" | head                  # hub + tool paths
curl -s  "https://tools.neonema.com/version.json"                        # commit that is live
```

### Distribution wiring

| Setting | Value |
|---------|-------|
| `/api/ip*` behavior | Precedence above default `*`, origin `neonema-tools-prod`, cache policy **CachingDisabled**, `revealip-ip-api` on **Viewer request** |
| Default `*` behavior | `tools-uri-rewrite` on **Viewer request** |

With Cloudflare proxied DNS, `revealip-ip-api` reads `cf-connecting-ip` for the real visitor IP.

Creating a function from scratch (only needed if one is deleted):

```bash
aws cloudfront create-function \
  --name <name> \
  --function-config Comment="<comment>",Runtime=cloudfront-js-2.0 \
  --function-code fileb://<source> \
  --profile neonema-tools
# then publish-function with the returned ETag
```

---

## Full release

1. `npm run brand:check && npm run test:json-converters && npm run test:password && npm run build`
2. Merge to `main`, or `npm run deploy -- platform` locally
3. If anything under `apps/*/cloudfront/` changed: `npm run deploy:edge -- platform`
4. Run the device and accessibility pass from [ADD_A_TOOL.md](./ADD_A_TOOL.md#7-pre-ship-checks) against production
