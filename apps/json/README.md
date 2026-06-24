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
npm run dev:json
```

Open [http://localhost:8080](http://localhost:8080).

## Dev scripts

```bash
npm run test:json-converters
```

## Deploy

Upload `apps/json/public/*` to your S3 bucket (bucket root, not a `public/` prefix). See [docs/deploy/](../../docs/deploy/) for AWS, Cloudflare, and AdSense guides.

## Roadmap

See `idea.md` in this directory for planned features.
