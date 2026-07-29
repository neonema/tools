# AGENTS: NeoNema Tools — working rules

Mandatory instructions for AI/LLM agents working in this repository.
Brand, palette, and copy rules live in [LLM_PRODUCT_RULES.md](LLM_PRODUCT_RULES.md) — this file covers structure, platform constraints, and workflow.

## Core product direction

- Build **utility websites** for NeoNema. Default scope is **one page per tool**.
- Static architecture, browser-first implementation, no signups.
- The promise to users: nothing they paste, upload, or type leaves their browser.

## Monorepo layout

| Path | Purpose |
|------|---------|
| `apps/hub/` | Tools hub shell — tab bar and hash router for tools.neonema.com |
| `apps/<tool>/public/` | One deployable static tool per folder |
| `packages/brand/` | Canonical tokens, header lock, parent logo — copy into apps, never symlink |
| `packages/utility-template/` | Starting point for new tools |
| `scripts/` | Build, deploy, scaffold, brand sync and check |
| `docs/` | Platform, deploy, and infra runbooks |

- **Adding a tool:** follow `docs/platform/ADD_A_TOOL.md`. Registration in `apps/hub/hub.config.json` and `scripts/build.mjs` is **manual** — there is no auto-discovery, and an unregistered tool is invisible.
- **Scaffold helper:** `npm run scaffold -- <tool-id> "<Tool Label>"` copies the template and syncs brand assets. It does not register anything.
- **Before merge or deploy:** `docs/platform/TOOL_CHECKLIST.md`.
- **Current platform state:** `docs/STATUS.md`.

## Platform constraints

- **No backend.** Tools are static files on a CDN; all processing happens in the browser (`public/app.js`). No `fetch()` to NeoNema-owned APIs, no databases, no Lambdas.
- **Documented exception:** RevealIP `/api/ip`, served by a CloudFront Function that returns the viewer's IP to the browser and persists nothing. Do not add comparable edge infrastructure to other tools unless explicitly requested and documented in `docs/platform/ARCHITECTURE.md`.
- **No third-party trackers.** No analytics, no ad networks, no `ads.txt`, no consent-requiring scripts. This is a product commitment, not a preference.
- **No new dependencies** — no build-time frameworks, npm runtime packages, or CDN scripts unless explicitly requested. Every tool ships as plain HTML, CSS, and JS.
- **Legal pages required:** each tool subtree ships `privacy-policy.html` and `terms.html` with copy that matches what the tool actually does.
- Avoid anything that creates recurring cost, rate-limit exposure, or operational overhead.

## Deploy model

- **Single origin:** one S3 bucket + one CloudFront distribution serve `tools.neonema.com` from the NeoNema tools AWS account.
- **Build:** `scripts/build.mjs` assembles `apps/hub/public` plus each tool's `public/` into `dist/` with path prefixes (`/json/`, `/revealip/`).
- **Deploy:** push to `main` deploys via GitHub Actions. `npm run deploy -- platform` is the local fallback and uses the `--profile neonema-tools` AWS CLI profile.
- **Edge functions:** `npm run deploy:edge -- platform` publishes `revealip-ip-api` and `tools-uri-rewrite`. Republish after editing anything under `apps/*/cloudfront/`.
- The company site (`neonema.com`) lives in a separate AWS account and repo. Never deploy to it from here.

## Delivery rules

- Keep pages lightweight, fast, and mobile-friendly.
- Keep copy clear and utility-first.
- Preserve the one-page flow per tool unless the user explicitly asks for multi-page expansion.
- Source brand tokens from `packages/brand/brand-tokens.css`; after brand changes run `npm run sync-brand` then `npm run brand:check`.
- Before proposing work as done: `npm run brand:check`, `npm run test:json-converters`, `npm run build`.
