# AGENTS: NeoNema Tools

Mandatory instructions for AI/LLM agents and contributors working in this repository.

## Core product direction

- Build **utility websites** for NeoNema. Default scope is **one page per tool**.
- Static architecture, browser-first implementation, no signups.
- The promise to users: nothing they paste, upload, or type leaves their browser.

## Monorepo layout

| Path | Purpose |
|------|---------|
| `apps/hub/` | Tools hub shell — tab bar and hash router for tools.neonema.com |
| `apps/<tool>/public/` | One deployable static tool per folder |
| `packages/brand/` | Canonical tokens, header lock, NeoNema logo — copy into apps, never symlink |
| `packages/utility-template/` | Starting point for new tools |
| `scripts/` | Build, deploy, scaffold, brand sync and check |
| `docs/` | Status, architecture, and runbooks |

- **Adding a tool:** follow `docs/ADD_A_TOOL.md`. Registration in `apps/hub/hub.config.json`, `scripts/build.mjs`, and the edge redirect function is **manual** — there is no auto-discovery, and an unregistered tool is invisible.
- **Scaffold helper:** `npm run scaffold -- <tool-id> "<Tool Label>"` copies the template and syncs brand assets. It registers nothing.
- **Current platform state:** `docs/STATUS.md`.

## Platform constraints

- **No backend.** Tools are static files on a CDN; all processing happens in the browser (`public/app.js`). No `fetch()` to NeoNema-owned APIs, no databases, no Lambdas.
- **Documented exception:** RevealIP `/api/ip`, served by a CloudFront Function that returns the viewer's IP to the browser and persists nothing. Do not add comparable edge infrastructure to other tools unless explicitly requested and documented in `docs/ARCHITECTURE.md`.
- **No third-party trackers.** No analytics, no ad networks, no `ads.txt`, no consent-requiring scripts. This is a product commitment, not a preference.
- **No new dependencies** — no build-time frameworks, npm runtime packages, or CDN scripts unless explicitly requested. Every tool ships as plain HTML, CSS, and JS.
- **Legal pages required:** each tool subtree ships `privacy-policy.html` and `terms.html` with copy that matches what the tool actually does.
- Avoid anything that creates recurring cost, rate-limit exposure, or operational overhead.

## Deploy model

- **Single origin:** one S3 bucket + one CloudFront distribution serve `tools.neonema.com` from the NeoNema tools AWS account.
- **Build:** `scripts/build.mjs` assembles `apps/hub/public` plus each tool's `public/` into `dist/` with path prefixes (`/json/`, `/revealip/`).
- **Deploy:** push to `main` deploys via GitHub Actions. `npm run deploy -- platform` is the local fallback and uses the `neonema-tools` AWS CLI profile.
- **Edge functions:** `npm run deploy:edge -- platform` publishes `revealip-ip-api` and `tools-uri-rewrite`. Republish after editing anything under `apps/*/cloudfront/`. CI does not do this.
- The company site (`neonema.com`) lives in a separate AWS account and repo. Never deploy to it from here.

---

# Product rules

## 1) Website shape

- Build each tool as a **single-page utility**.
- Keep the flow direct: headline → tool → output → trust/legal links.
- No unnecessary navigation. The hub provides cross-tool navigation; tools do not.
- Public entry is the hub (`tools.neonema.com/#/<tool-id>`), not standalone `/tool-id/` landing pages.
- Preserve the one-page flow unless the user explicitly asks for multi-page expansion.

## 2) Privacy posture

The product's main differentiator — a hard requirement, not marketing copy.

- Everything runs in the browser. User input never reaches NeoNema infrastructure.
- No analytics, no ad networks, no trackers, no cookies beyond what the tool itself needs.
- Say so plainly on the page, and make sure `privacy-policy.html` describes what the tool actually does — no boilerplate, no placeholders.

## 3) Mandatory NeoNema palette

Canonical tokens live in `packages/brand/brand-tokens.css`:

| Token | Value |
|-------|-------|
| `--background` | `#0b0f0d` |
| `--foreground` | `#ffffff` |
| `--card` | `#18211d` |
| `--primary` | `#39d98a` |
| `--muted` | `#9da7a2` |
| `--border` | `#25322d` |
| `--header-bg` | `#111815` |

Never introduce a conflicting visual language or an ad-hoc color set.

## 4) Theme consistency

- Dark, high-contrast NeoNema style.
- Typography: Outfit with a system sans fallback.
- `--primary` carries key actions and highlights.
- The locked header block must stay identical to `packages/brand/header-lock.css` — `npm run brand:check` enforces this.
- Header branding is **NeoNema only** — no per-tool logos or “A product of” dual-brand headers.
- After brand changes run `npm run sync-brand`, then `npm run brand:check`.

## 5) Brand language

- Brand is **NeoNema**; tools are NeoNema utilities under the company logo, not separate product brands.

## 6) Traffic and discoverability

Current focus is **bringing users to the site**, not monetizing them.

- Ship real utility value on every page: clear headline, working tool, obvious outcome.
- Accurate `<title>`, meta description, canonical URL, and favicon (`NeoNema.png`) per tool.
- Fast and mobile-friendly; no layout shift on load.
- Keep copy clear and utility-first.
- Do **not** add Google AdSense, `ads.txt`, ad slots, or any ad placement. The tools are not monetized, and ad scripts would break the privacy promise in section 2.

---

## Before calling work done

```bash
npm run brand:check
npm run test:json-converters
npm run build
```

All three must pass. `brand:check` is the first step in the deploy workflow — if it fails, nothing ships.
