# Infrastructure

AWS account model and deploy credentials for **tools.neonema.com**.

## Two-account model

NeoNema uses **two separate AWS accounts** — one per product boundary. DNS (Cloudflare) sits outside AWS and routes each hostname to the correct CloudFront distribution.

| AWS account | Hostnames | Repo | This repo? |
|-------------|-----------|------|------------|
| **NeoNema tools** | `tools.neonema.com` | `neonema-tools` | **Yes** — all deploy automation here |
| **NeoNema company** | `neonema.com` (+ `www` if used) | Separate company-site repo | **No** — marketing site only |

Each account is a self-contained static stack: **private S3 bucket → CloudFront (OAC) → ACM cert (us-east-1) → IAM deploy role**. No cross-account S3 origins — CloudFront in the tools account reads only the tools bucket.

```
Cloudflare DNS
├── neonema.com        → CloudFront (company account) → S3 company site
└── tools.neonema.com  → CloudFront (tools account)   → S3 neonema-tools-prod
```

**Why two accounts:** blast-radius isolation (a tools deploy cannot touch the company site), separate IAM per repo, and a clean boundary as `neonema.com` grows beyond utilities.

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

The IAM trust policy and permissions are checked in under [`infra/iam/`](../../infra/iam/). There is no Terraform or CDK — the stack is small enough that Console setup plus those policy documents is proportionate. See [STATUS.md](../STATUS.md).

## CI credentials

GitHub Actions assumes `github-neonema-tools-deploy` via OIDC. No long-lived keys, no AWS secrets in the repo or in GitHub. Permissions are scoped to the prod bucket, CloudFront invalidation, and edge function publish.

## Local AWS CLI profile

Local deploys use the **`neonema-tools`** profile, pointing at the tools account.

```bash
aws configure --profile neonema-tools
# Default region: us-east-1
# Output format:  json

aws sts get-caller-identity --profile neonema-tools   # verify the account
```

Set `awsProfile` to `"neonema-tools"` in `deploy.config.json` (already the case in [deploy.config.example.json](../../deploy.config.example.json)). Deploy scripts pass `--profile` to the AWS CLI automatically when the field is set.

## Legacy stacks

Per-app RevealIP and JSON stacks lived in older AWS accounts. Those accounts are closed. Legacy hostnames 301 via Cloudflare; see [platform/DOMAIN_CUTOVER.md](../platform/DOMAIN_CUTOVER.md).
