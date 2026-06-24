# Infrastructure (planned)

This directory is reserved for AWS infrastructure as code and account migration work.

## Current state

- Each app is deployed manually to separate AWS accounts (RevealIP, JSON toolkit).
- Hosting pattern: private S3 bucket + CloudFront OAC + optional Cloudflare DNS.

## Planned (Phase 4)

- Consolidate deployments into the main **NeoNema LLC** AWS account
- Add IaC (Terraform or CDK) with shared modules for S3 + CloudFront
- Per-app stacks under `infra/apps/<name>/`
- RevealIP CloudFront Function as app-specific infra

No IaC files exist yet. See [docs/deploy/](../deploy/) for current manual runbooks.
