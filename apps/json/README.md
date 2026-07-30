# JSON Utility Toolkit

NeoNema-branded, privacy-first JSON workstation. All processing runs in the browser.

## Tools

- **Validate/Format/Lint** — parse, explain errors, pretty-print, minify
- **Type Generator** — infer TypeScript interfaces or Zod schemas
- **Diff Finder** — structural compare with JSON Pointer paths
- **Selector** — JSONPath-style queries with shareable URL state
- **Converters** — JSON, CSV, YAML, JS object literals, Markdown tables

## Local preview

From the monorepo root:

```bash
npm run dev
```

Open [http://localhost:8765/#/json](http://localhost:8765/#/json) — the hub loads this tool in its iframe, the same way production does.

## Dev scripts

```bash
npm run test:json-converters
```

## Deploy

This tool deploys as part of the platform — `npm run build` copies `public/` into `dist/json/`, and a push to `main` ships it. See [docs/DEPLOY.md](../../docs/DEPLOY.md).

Public entry is `https://tools.neonema.com/#/json`; `/json/` serves iframe assets only.

## Roadmap

`idea.md` in this directory is an unfiltered brainstorm of candidate JSON tools — not a committed plan.
