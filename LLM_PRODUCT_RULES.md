# LLM Product Rules: NeoNema Utility Sites

Use these rules for all generated features, edits, and new templates in this repository.

## Monorepo layout

- Live products: `apps/<name>/public/` (deploy folder)
- Tools hub: `apps/hub/` (tab shell for tools.neonema.com)
- Shared brand source: `packages/brand/` (copy into apps — do not symlink)
- New utilities: start from `packages/utility-template/`
- Platform architecture: `docs/platform/ARCHITECTURE.md`
- **Adding a tool to the hub:** `docs/platform/ADD_A_TOOL.md` (manual `hub.config.json` + `build.mjs` steps)
- After brand changes, run `npm run sync-brand` then `npm run brand:check`

## Platform constraints

- **Static CDN only:** each tool is a one-page static site; no NeoNema backend, database, or user-data relay.
- **Browser-first processing:** tool logic runs in `public/app.js`; do not send user input to NeoNema infrastructure.
- **No NeoNema API calls:** do not add `fetch()` to NeoNema-owned APIs unless explicitly approved and documented.
- **Deploy target:** unified build to `dist/` → `tools.neonema.com` (single S3 bucket + CloudFront). See `docs/platform/ARCHITECTURE.md`.
- **Legal pages required:** every tool subtree must ship `privacy-policy.html` and `terms.html`.
- **Edge exception:** RevealIP `/api/ip` CloudFront Function only — returns viewer IP to browser; NeoNema does not persist it.

## 1) Website Shape

- Build as a **single-page utility site** by default.
- Keep the user flow direct: headline, tool, output, and optional trust/legal links.
- Do not add unnecessary navigation complexity.

## 2) Low-Overhead Requirement

- No backend/API integration by default.
- No expensive third-party services by default.
- Keep processing local to the browser where possible.
- If external calls are unavoidable, clearly mark them as optional and explain why.

**Exception:** RevealIP (`apps/revealip/`) requires a CloudFront Function for `/api/ip` because public IP detection cannot be done purely in the browser. Do not add similar edge infrastructure to other apps unless explicitly requested.

## 3) Mandatory NeoNema Palette

Canonical tokens live in `packages/brand/brand-tokens.css`. Use these values:

- `--background: #0b0f0d`
- `--foreground: #ffffff`
- `--card: #18211d`
- `--primary: #39d98a`
- `--muted: #9da7a2`
- `--border: #25322d`
- `--header-bg: #111815`

## 4) Theme Consistency

- Use dark, high-contrast NeoNema visual style.
- Keep typography modern and clean (Outfit/system sans stack).
- Primary accent usage should center around `--primary` for key actions and highlights.
- Keep the locked header block identical to `packages/brand/header-lock.css`.

## 5) Brand Language

- Parent brand is **NeoNema**.
- Products should be presented as NeoNema utility products.

## 6) Traffic and Discoverability

Current product focus is **bringing users to the site**, not ad monetization.

- Ship unique, useful utility value on every page (clear headline, tool, outcome).
- Include accurate `<title>`, meta description, and favicon per tool.
- Keep pages fast and mobile-friendly.
- Provide `privacy-policy.html` and `terms.html` for user trust — not as an ad-network prerequisite.
- Do **not** add Google AdSense, `ads.txt`, or ad placement blocks unless explicitly requested.
- **Backlog:** remove existing AdSense integration (scripts, slots, `ads.txt`, privacy-policy ad copy) — sites are not monetized. Tracker: `docs/TOOLS_PLATFORM_PLAN.md` → **Remove AdSense (backlog)**.
- Public tool entry is via the hub (`tools.neonema.com/#/<tool-id>`), not standalone `/tool-id/` landing pages.
