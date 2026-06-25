# NeoNema Tools

**Canonical repository** for all NeoNema utility products, shared brand assets, deploy automation, and platform docs.

- **Production (target):** [tools.neonema.com](https://tools.neonema.com) — single origin hosting the hub and every tool (`#/json`, `#/revealip`, …).
- **Legacy:** per-app repos and legacy AWS accounts are being retired after platform cutover into the **NeoNema tools account** (see [docs/platform/ARCHITECTURE.md](docs/platform/ARCHITECTURE.md)).

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

Requires the **`neonema-tools`** AWS CLI profile (NeoNema tools account). See [docs/infra/README.md](docs/infra/README.md).

```bash
aws configure --profile neonema-tools          # once: credentials for tools account
cp deploy.config.example.json deploy.config.json   # once: fill in bucket + distribution IDs
npm run build                                  # assemble dist/ (platform deploy)
npm run deploy -- platform --dry-run
npm run deploy -- platform
npm run deploy -- json --dry-run               # interim: per-app legacy buckets
npm run deploy:edge -- revealip   # only when ip-api-function.js changes
```

See [docs/deploy/automated-deploy.md](docs/deploy/automated-deploy.md).

## Documentation

- [Platform architecture](docs/platform/ARCHITECTURE.md) — single-origin model, static-only rules, tab routing
- [Platform plan & checklist](docs/TOOLS_PLATFORM_PLAN.md) — P0–P7 execution tracker
- [Deployment guides](docs/deploy/) — AWS, Cloudflare, AdSense, automated deploy
- [Infrastructure](docs/infra/) — two-account model, `neonema-tools` AWS profile
- [AGENTS.md](AGENTS.md) — LLM agent instructions
- [LLM_PRODUCT_RULES.md](LLM_PRODUCT_RULES.md) — product and design rules

## Adding a new utility

1. Copy `packages/utility-template/` to `apps/<name>/`.
2. Copy brand assets from `packages/brand/` into the new app's `public/`.
3. Customize `index.html`, `app.js`, and legal pages.
4. Run `npm run brand:check`.
