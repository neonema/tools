# Phase 2 Normalization Checklist

Hardening after the Phase 1 monorepo migration: brand parity, tooling, CI, and doc cleanup.

## Brand normalization

- [x] RevealIP `styles.css` uses `brand-tokens.css` import + `BRAND_LOCK` markers (done in Phase 1)
- [x] `brand-check.mjs` scans all `apps/*/public/` + utility-template (done in Phase 1)
- [x] `brand-check.mjs` verifies `brand-tokens.css` matches `packages/brand/` exactly
- [x] `brand-check.mjs` verifies `NeoNema.png` hash matches canonical
- [x] `brand-check.mjs` verifies locked header block matches `packages/brand/header-lock.css`
- [x] Add `scripts/sync-brand.mjs` + `npm run sync-brand` (all apps or single app)

## CI/CD

- [x] GitHub Actions workflow (`.github/workflows/ci.yml`)
- [x] CI runs `npm run brand:check` on push/PR to `main`
- [x] CI runs `npm run test:json-converters` on push/PR to `main`

## Documentation

- [x] `docs/deploy/README.md` per-app deploy matrix (done in Phase 1)
- [x] Fix stale links in `docs/deploy/adsense.md`
- [x] Fix stale links in `docs/deploy/aws-s3-cloudfront.md`
- [x] Update `LLM_PRODUCT_RULES.md` for monorepo layout + RevealIP edge exception
- [x] Update `README.md` and `packages/brand/README.md` with `sync-brand` usage

## Cleanup

- [x] Remove stray root `public/` directory (leftover template files)

## Verification

- [x] `npm run sync-brand` succeeds
- [x] `npm run brand:check` passes for all apps
- [x] `npm run test:json-converters` passes

## Deferred (Phase 3+)

- [x] Deploy automation (`aws s3 sync` + CloudFront invalidation scripts) — see Phase 3
- [ ] AWS IaC and account migration (`docs/infra/`)
- [ ] Archive standalone GitHub repos (`revealip-neonema`, `json-neonema`)
- [ ] Git history import from old repos

## Post-Phase 2 manual steps

- [ ] Push to GitHub and confirm CI passes on `main`
- [ ] Update any external deploy scripts to use `apps/<name>/public/`
- [ ] Run `npm run sync-brand` after any edit to `packages/brand/`
