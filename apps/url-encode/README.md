# NeoNema Utility Website Template

Reusable starter for **one-page utility websites** under the NeoNema brand.

## Template goals

- One-page static website architecture
- Minimal overhead and minimal recurring cost
- Browser-first processing (avoid server/API dependencies by default)
- Consistent NeoNema visual theme and color palette

## Project structure

- `public/index.html` — main page template
- `public/styles.css` — NeoNema palette + layout styles
- `public/app.js` — sample client-side utility logic
- `public/brand-tokens.css` — copied from `packages/brand/` at scaffold time
- `public/privacy-policy.html` — policy placeholder
- `public/terms.html` — terms placeholder

## Local preview

The template is not served on its own — the dev server only mounts registered apps under `apps/`. Scaffold it into a real app first, add the `MOUNTS` entry described in [docs/ADD_A_TOOL.md](../../docs/ADD_A_TOOL.md#3-register-in-the-build), then run `npm run dev` from the monorepo root and open `http://localhost:8765/<your-app-name>/`.

## How to create a new utility

1. Copy this folder to `apps/<your-app-name>/`.
2. Sync brand assets from `packages/brand/`:

   ```bash
   npm run sync-brand -- <your-app-name>
   ```

3. Rename the product title/metadata in `public/index.html`.
4. Replace demo utility logic in `public/app.js`.
5. Update policy/legal placeholders before publishing.
6. Run `npm run brand:check` from the repo root.
