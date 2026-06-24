# NeoNema Tools

Monorepo for NeoNema utility websites and shared brand assets. This repository is the source of truth for all NeoNema tools.

## Apps

| App | Path | Description |
|-----|------|-------------|
| RevealIP | `apps/revealip/` | Public IPv4/IPv6 display (S3 + CloudFront + edge function) |
| JSON Toolkit | `apps/json/` | Browser-based JSON validate, diff, JSONPath, converters |

## Packages

| Package | Path | Description |
|---------|------|-------------|
| Brand | `packages/brand/` | Canonical design tokens, header lock, parent logo |
| Utility template | `packages/utility-template/` | Scaffold for new one-page utilities |

## Local development

```bash
npm run dev:revealip    # http://localhost:8080
npm run dev:json        # http://localhost:8080
npm run dev:template    # http://localhost:8080
```

## Quality checks

```bash
npm run brand:check
npm run test:json-converters
npm run sync-brand          # copy packages/brand/ into all apps
npm run sync-brand -- json  # sync a single app
```

## Deploy

```bash
cp deploy.config.example.json deploy.config.json   # once: fill in bucket + distribution IDs
npm run deploy -- json --dry-run
npm run deploy -- json
npm run deploy:edge -- revealip   # only when ip-api-function.js changes
```

See [docs/deploy/automated-deploy.md](docs/deploy/automated-deploy.md).

## Documentation

- [Deployment guides](docs/deploy/) — AWS, Cloudflare, AdSense, automated deploy
- [Infrastructure (planned)](docs/infra/) — future AWS account migration
- [AGENTS.md](AGENTS.md) — LLM agent instructions
- [LLM_PRODUCT_RULES.md](LLM_PRODUCT_RULES.md) — product and design rules

## Adding a new utility

1. Copy `packages/utility-template/` to `apps/<name>/`.
2. Copy brand assets from `packages/brand/` into the new app's `public/`.
3. Customize `index.html`, `app.js`, and legal pages.
4. Run `npm run brand:check`.
