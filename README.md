# NeoNema Tools

**Canonical repository** for all NeoNema utility products, shared brand assets, deploy automation, and platform docs.

- **Production:** [tools.neonema.com](https://tools.neonema.com) — single origin hosting the hub and every tool (`#/json`, `#/revealip`, …).
- **Privacy:** tools run entirely in the browser. No accounts, no analytics, no ads, no user data stored or relayed.
- **Status:** [docs/STATUS.md](docs/STATUS.md) — what is live, what is open, what is deliberately not built.

## Apps

| App | Path | Description |
|-----|------|-------------|
| Hub | `apps/hub/` | Tab shell and router for tools.neonema.com |
| RevealIP | `apps/revealip/` | Public IPv4/IPv6 display (edge function for `/api/ip`) |
| JSON Toolkit | `apps/json/` | Browser-based JSON validate, diff, JSONPath, converters |

## Packages

| Package | Path | Description |
|---------|------|-------------|
| Brand | `packages/brand/` | Canonical design tokens, header lock, parent logo |
| Utility template | `packages/utility-template/` | Scaffold for new one-page utilities |

## Local development

**Hub preview** (tab bar + iframes, port 8765):

```bash
npm run dev       # fast — no build; serves apps/ directly
npm run preview   # prod-like — builds dist/ then serves it (pre-merge smoke tests)
```

See [docs/platform/PREVIEW.md](docs/platform/PREVIEW.md) for smoke URLs and the RevealIP `/api/ip` caveat.

**Single-tool dev** (focused work, port 8080):

```bash
npm run dev:revealip
npm run dev:json
npm run dev:template
```

## Quality checks

```bash
npm run brand:check
npm run test:json-converters
npm run sync-brand          # copy packages/brand/ into all apps
npm run sync-brand -- json  # sync a single app
```

## Deploy

Production deploys run from GitHub Actions on push to `main`. Local deploys are the fallback and need the **`neonema-tools`** AWS CLI profile — see [docs/infra/README.md](docs/infra/README.md).

```bash
aws configure --profile neonema-tools              # once: credentials for tools account
cp deploy.config.example.json deploy.config.json   # once: fill in bucket + distribution IDs
npm run build                                      # assemble dist/
npm run deploy -- platform --dry-run
npm run deploy -- platform
npm run deploy:edge -- platform   # only when a cloudfront/*.js function changes
```

See [docs/deploy/automated-deploy.md](docs/deploy/automated-deploy.md).

## Documentation

- [Platform status](docs/STATUS.md) — live state, open items, non-goals
- [Local preview](docs/platform/PREVIEW.md) — `npm run dev` vs `npm run preview`
- [Platform architecture](docs/platform/ARCHITECTURE.md) — single-origin model, static-only rules, tab routing
- [Add a tool](docs/platform/ADD_A_TOOL.md) — the runbook for shipping a new utility
- [Pre-ship checklist](docs/platform/TOOL_CHECKLIST.md) — legal pages, device and accessibility smoke
- [Deployment guides](docs/deploy/) — AWS, Cloudflare, automated deploy
- [Infrastructure](docs/infra/) — two-account model, `neonema-tools` AWS profile
- [AGENTS.md](AGENTS.md) — LLM agent instructions
- [LLM_PRODUCT_RULES.md](LLM_PRODUCT_RULES.md) — product and design rules

## Adding a new utility

Follow [docs/platform/ADD_A_TOOL.md](docs/platform/ADD_A_TOOL.md). A tool is not live until it is registered in **both** `apps/hub/hub.config.json` and `scripts/build.mjs` — the hub does not discover apps automatically.

```bash
npm run scaffold -- <tool-id> "<Tool Label>"
```
