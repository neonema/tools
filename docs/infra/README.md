# Infrastructure (planned)

This directory is reserved for AWS infrastructure as code and account migration work for **tools.neonema.com**.

## Two-account model (target)

NeoNema uses **two separate AWS accounts** — one per product boundary. DNS (Cloudflare) sits outside AWS and routes each hostname to the correct CloudFront distribution.

| AWS account | Hostnames | Repo | This repo? |
|-------------|-----------|------|------------|
| **NeoNema tools** | `tools.neonema.com`, `dev.tools.neonema.com` | `neonema-tools` | **Yes** — all deploy automation here |
| **NeoNema company** | `neonema.com` (+ `www` if used) | Separate company-site repo | **No** — marketing site only; links out to the tools hub |

Each account is a self-contained static stack: **private S3 bucket → CloudFront (OAC) → ACM cert (us-east-1) → IAM deploy role**. No cross-account S3 origins are required — CloudFront in the tools account reads only the tools buckets.

```
Cloudflare DNS
├── neonema.com          → CloudFront (company account) → S3 company site
└── tools.neonema.com    → CloudFront (tools account)   → S3 neonema-tools-prod
    dev.tools.neonema.com → CloudFront (tools account)  → S3 neonema-tools-dev
```

**Why two accounts:** blast-radius isolation (tools deploy cannot touch the company site), separate IAM for each repo, and a clear boundary as `neonema.com` grows beyond utilities.

See [platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md) for the tools hosting layout and [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) P1 for the cutover checklist.

## AWS CLI profile for this repo

All local deploy commands in `neonema-tools` use the **`neonema-tools`** AWS CLI profile, which must point at the **NeoNema tools AWS account**.

### One-time setup

```bash
aws configure --profile neonema-tools
# AWS Access Key ID:     (IAM user or SSO session for the tools account)
# AWS Secret Access Key: (if using access keys)
# Default region:        us-east-1
# Default output format: json
```

Verify you are in the tools account (not the company account or legacy per-app accounts):

```bash
aws sts get-caller-identity --profile neonema-tools
```

Set `awsProfile` to `"neonema-tools"` in `deploy.config.json` (the `platform` entry in [deploy.config.example.json](../../deploy.config.example.json) already uses this name). Deploy scripts pass `--profile neonema-tools` to the AWS CLI automatically when the field is set.

**CI (P5):** GitHub Actions uses OIDC to assume a role in the tools account — no long-lived keys or CLI profiles in CI. Local `neonema-tools` remains the fallback for manual deploys.

## Current state

- Legacy RevealIP and JSON toolkit stacks may still live in **separate per-app AWS accounts** from before the monorepo.
- Hosting pattern everywhere: private S3 bucket + CloudFront OAC + Cloudflare DNS.

## Planned (P1 / platform cutover)

- [ ] Consolidate legacy RevealIP / JSON stacks into the **NeoNema tools AWS account** (not the company account)
- [ ] Provision `neonema-tools-prod` S3 + CloudFront for `tools.neonema.com`
- [ ] Wire RevealIP CloudFront Function on the unified distribution (`/api/ip`)
- [ ] Use `neonema-tools` profile for all platform deploys from this repo
- [ ] Add IaC (Terraform or CDK) with shared modules for S3 + CloudFront (optional before P5)

No IaC files exist yet. See [docs/deploy/](../deploy/) for manual runbooks and [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) for the full checklist.

## Tools account layout (target)

```
NeoNema tools AWS account          (local CLI: --profile neonema-tools)
├── S3: neonema-tools-prod         (tools.neonema.com)
├── S3: neonema-tools-dev          (dev.tools.neonema.com)
├── CloudFront: tools-prod         (OAC → prod bucket)
├── CloudFront: tools-dev          (OAC → dev bucket)
├── ACM (us-east-1): tools.neonema.com, dev.tools.neonema.com
├── CloudFront Function: revealip-ip-api  (/api/ip on tools-prod distribution)
└── IAM: GitHub OIDC role          (deploy on push to main / dev — P5)
```

Legacy per-app buckets and distributions in old accounts retire after P3 cutover (30-day soak). See P3.8 in [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md).
