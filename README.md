# NeoNema Utility Website Template

This repository is a reusable starter for **one-page utility websites** under the NeoNema brand.

## Template goals
- One-page static website architecture.
- Minimal overhead and minimal recurring cost.
- Browser-first processing (avoid server/API dependencies by default).
- Consistent NeoNema visual theme and color palette.

## Project structure
- `public/index.html` main page template
- `public/styles.css` NeoNema palette + layout styles
- `public/app.js` sample client-side utility logic
- `public/privacy-policy.html` policy placeholder
- `public/terms.html` terms placeholder
- `AGENTS.md` LLM instruction entrypoint
- `LLM_PRODUCT_RULES.md` enforced product and design rules

## Local preview
Run from this repository root:

`python3 -m http.server 8080`

Then open [http://localhost:8080/public/](http://localhost:8080/public/).

## How to use this template
1. Rename the product title/metadata in `public/index.html`.
2. Replace demo utility logic in `public/app.js`.
3. Keep design tokens in `public/styles.css` aligned with NeoNema palette.
4. Update policy/legal placeholders before publishing.
