# Phase 1 Migration Checklist

Monorepo restructure: combine `revealip-neonema` and `json-neonema` into this repo. Brand sharing uses **Option A** (copy `packages/brand/` into each app at scaffold time).

## Structure

- [x] Create `apps/`, `packages/`, `docs/` directory layout
- [x] Create `docs/deploy/` for consolidated runbooks
- [x] Create `docs/infra/` placeholder for future AWS migration

## Packages

- [x] Create `packages/brand/` with `brand-tokens.css`, `header-lock.css`, `NeoNema.png`
- [x] Add `packages/brand/README.md` documenting copy-at-scaffold workflow
- [x] Move template from repo root to `packages/utility-template/`
- [x] Add `packages/utility-template/README.md`

## Apps — RevealIP

- [x] Copy `public/` → `apps/revealip/public/`
- [x] Copy `cloudfront/` → `apps/revealip/cloudfront/`
- [x] Copy brand assets into `apps/revealip/public/` (Option A)
- [x] Align `apps/revealip/public/styles.css` with brand import + `BRAND_LOCK` markers
- [x] Add `apps/revealip/README.md`

## Apps — JSON Toolkit

- [x] Copy `public/` → `apps/json/public/`
- [x] Copy `scripts/test-converters.mjs` → `apps/json/scripts/`
- [x] Copy `idea.md` → `apps/json/`
- [x] Copy brand assets into `apps/json/public/` (Option A)
- [x] Add `apps/json/README.md`

## Docs consolidation

- [x] Merge AWS guide → `docs/deploy/aws-s3-cloudfront.md`
- [x] Merge Cloudflare guide → `docs/deploy/cloudflare-dns.md`
- [x] Merge AdSense guide → `docs/deploy/adsense.md`
- [x] Copy device test checklist → `docs/deploy/device-test-checklist.md`
- [x] Copy RevealIP launch order → `docs/deploy/order-of-operations.md`
- [x] Add RevealIP edge function doc → `docs/deploy/revealip-cloudfront-function.md`
- [x] Add `docs/deploy/README.md` with per-app deploy matrix
- [x] Update doc paths to monorepo conventions (`apps/<name>/public/`)

## Root tooling

- [x] Update `scripts/brand-check.mjs` to scan all `apps/*/public/` + template
- [x] Update root `package.json` with monorepo scripts
- [x] Replace root `README.md` with monorepo overview
- [x] Remove old root `public/` template files

## Verification

- [x] `npm run brand:check` passes for all apps
- [x] `npm run test:json-converters` passes

## Intentionally deferred (later phases)

- [ ] Git history import (`git subtree` / `filter-repo`) from old repos
- [x] CI/CD (GitHub Actions for `brand:check`) — see Phase 2
- [ ] AWS IaC and account migration (`docs/infra/`)
- [x] Automated brand sync script (`npm run sync-brand`) — see Phase 2
- [ ] Archive or redirect old GitHub repos (`revealip-neonema`, `json-neonema`)

## Post-migration manual steps

- [ ] Update any external bookmarks or deploy scripts pointing at old repo paths
- [x] Point CI/CD at monorepo checks (`.github/workflows/ci.yml`) — deploy automation deferred to Phase 3
- [ ] Decide when to archive the standalone repos on GitHub
