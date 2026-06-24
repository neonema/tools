# AGENTS: NeoNema Utility Website Standards

This file defines mandatory instructions for AI/LLM agents working in this repository.

## Core Product Direction
- Build **utility websites** for NeoNema.
- Default scope is **one-page websites**.
- Prefer static architecture and browser-first implementation.

## Monorepo Layout
- Live products live under `apps/<name>/` (each has its own `public/` deploy folder).
- The tools hub shell lives under `apps/hub/` (tab navigation for tools.neonema.com).
- Shared brand assets live in `packages/brand/` — copy into an app's `public/` when scaffolding (do not symlink).
- New utilities start from `packages/utility-template/`.
- Platform architecture: `docs/platform/ARCHITECTURE.md`.
- Deployment runbooks live in `docs/deploy/`.

## Platform Deploy Model
- **Target:** single origin at `tools.neonema.com` — one S3 bucket + one CloudFront distribution.
- **Build output:** `scripts/build.mjs` assembles `apps/hub/public`, `apps/json/public`, `apps/revealip/public`, etc. into `dist/` with path prefixes (`/json/`, `/revealip/`).
- **Deploy:** `npm run deploy -- platform` syncs `dist/` to the prod bucket (see `docs/platform/ARCHITECTURE.md`).
- Per-app deploy (`npm run deploy -- json`) remains during migration; new work should assume the unified model.

## Cost and Overhead Rules
- **No backend:** tools are static CDN sites; all processing happens in the browser (`public/app.js`). No `fetch()` to NeoNema-owned APIs.
- Avoid adding APIs, backend services, databases, or third-party dependencies unless explicitly requested.
- **Documented exception:** RevealIP `/api/ip` via CloudFront Function only — see `docs/platform/ARCHITECTURE.md`.
- Avoid features that create rate-limiting risk, recurring usage fees, or operational overhead.
- Prefer client-side processing in each app's `public/app.js`.

## Theme and Palette Rules
- Always keep the NeoNema design system and color palette aligned with `LLM_PRODUCT_RULES.md`.
- Do not introduce a conflicting visual language or random color sets.
- Source canonical tokens from `packages/brand/brand-tokens.css`; run `npm run sync-brand` then `npm run brand:check` after brand changes.

## Delivery Rules for Agents
- Keep pages lightweight, fast, and mobile-friendly.
- Keep copy clear and utility-first.
- If changing structure, preserve one-page flow unless user explicitly asks for multi-page expansion.
