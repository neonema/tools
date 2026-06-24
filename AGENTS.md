# AGENTS: NeoNema Utility Website Standards

This file defines mandatory instructions for AI/LLM agents working in this repository.

## Core Product Direction
- Build **utility websites** for NeoNema.
- Default scope is **one-page websites**.
- Prefer static architecture and browser-first implementation.

## Monorepo Layout
- Live products live under `apps/<name>/` (each has its own `public/` deploy folder).
- Shared brand assets live in `packages/brand/` — copy into an app's `public/` when scaffolding (do not symlink).
- New utilities start from `packages/utility-template/`.
- Deployment runbooks live in `docs/deploy/`.

## Cost and Overhead Rules
- Avoid adding APIs, backend services, databases, or third-party dependencies unless explicitly requested.
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
