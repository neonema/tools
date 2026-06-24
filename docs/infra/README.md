# Infrastructure (planned)

This directory is reserved for AWS infrastructure as code and account migration work.

## Current state

- Each app is deployed manually to separate AWS accounts (RevealIP, JSON toolkit).
- Hosting pattern: private S3 bucket + CloudFront OAC + optional Cloudflare DNS.

## Planned (P1 / platform cutover)

- Consolidate deployments into the main **NeoNema LLC** AWS account
- Single S3 bucket `neonema-tools-prod` + CloudFront for `tools.neonema.com` (see [platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md))
- Add IaC (Terraform or CDK) with shared modules for S3 + CloudFront
- RevealIP CloudFront Function on the unified distribution (`/api/ip`)

No IaC files exist yet. See [docs/deploy/](../deploy/) for current manual runbooks and [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) for the full checklist.
