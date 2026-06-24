# Phase 3 Deploy Automation Checklist

Local-first deploy scripts. No AWS credentials in the repo.

## Scripts

- [x] `deploy.config.example.json` — per-app S3 + CloudFront template
- [x] `deploy.config.json` gitignored (you create from example)
- [x] `scripts/deploy.mjs` — `s3 sync` + CloudFront invalidation
- [x] `scripts/deploy-edge.mjs` — publish RevealIP CloudFront Function
- [x] `scripts/lib/deploy-config.mjs` — shared config loader
- [x] npm scripts: `deploy`, `deploy:edge`
- [x] `docs/deploy/automated-deploy.md`

## Intentionally deferred (Phase 4+)

- [ ] GitHub Actions push-to-deploy (needs OIDC or secrets you configure)
- [ ] AWS IaC (Terraform/CDK) and NeoNema LLC account migration
- [ ] Archive standalone GitHub repos

## Your setup steps

- [ ] Install AWS CLI v2
- [ ] Configure credentials (`aws configure` or per-app profiles)
- [ ] Copy `deploy.config.example.json` → `deploy.config.json`
- [ ] Fill in bucket names, regions, and CloudFront distribution IDs
- [ ] Run `npm run deploy -- json --dry-run` to verify commands
- [ ] Run a real deploy when ready

## Information needed (not tokens)

Provide these in `deploy.config.json` locally — safe to keep out of git:

| App | S3 bucket | Region | CloudFront distribution ID | AWS profile (if separate account) |
|-----|-----------|--------|----------------------------|-----------------------------------|
| revealip | ? | ? | ? | ? |
| json | ? | ? | ? | ? |

RevealIP only: CloudFront Function name (e.g. `revealip-ip-api`).

## Verification

- [ ] `npm run deploy -- json --dry-run` prints expected `aws s3 sync` command
- [ ] `npm run deploy -- revealip --dry-run` prints sync + invalidation
- [ ] After config filled: real deploy succeeds and site loads
