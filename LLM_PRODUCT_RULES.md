# LLM Product Rules: NeoNema utility sites

Product, design, and copy rules for every tool in this repository.
Repo structure, platform constraints, and deploy workflow live in [AGENTS.md](AGENTS.md).

## 1) Website shape

- Build each tool as a **single-page utility**.
- Keep the flow direct: headline → tool → output → trust/legal links.
- No unnecessary navigation. The hub provides cross-tool navigation; tools do not.
- Public entry is the hub (`tools.neonema.com/#/<tool-id>`), not standalone `/tool-id/` landing pages.

## 2) Privacy posture

This is the product's main differentiator — treat it as a hard requirement, not marketing copy.

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

## 5) Brand language

- Parent brand is **NeoNema**; each tool is presented as a NeoNema utility product.

## 6) Traffic and discoverability

Current focus is **bringing users to the site**, not monetizing them.

- Ship real utility value on every page: clear headline, working tool, obvious outcome.
- Accurate `<title>`, meta description, and favicon per tool.
- Fast and mobile-friendly; no layout shift on load.
- `privacy-policy.html` and `terms.html` exist for user trust.
- Do **not** add Google AdSense, `ads.txt`, ad slots, or any ad placement. The tools are not monetized, and ad scripts would break the privacy promise in section 2.
