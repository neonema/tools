# NeoNema Brand Package

Canonical source for shared NeoNema design assets used across utility sites.

## Files

- `brand-tokens.css` — locked CSS custom properties (`:root` palette)
- `header-lock.css` — reference copy of the locked header block (for scaffolding)
- `NeoNema.png` — parent brand logo

## Usage (copy at scaffold time)

When creating or updating a utility app, sync brand files into the app's `public/` directory:

```bash
npm run sync-brand -- <app-name>   # single app
npm run sync-brand                 # all apps + utility-template
```

Or copy manually:

```bash
cp packages/brand/brand-tokens.css apps/<app-name>/public/
cp packages/brand/NeoNema.png apps/<app-name>/public/
```

Each app's `public/styles.css` must:

1. Import tokens: `@import url("./brand-tokens.css");`
2. Include the locked header block between `BRAND_LOCK_START` and `BRAND_LOCK_END` markers (see `header-lock.css` or `packages/utility-template/public/styles.css`)

Run `npm run brand:check` from the repo root to verify all apps comply.
