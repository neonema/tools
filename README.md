# NeoNema Tools

**Canonical repository** for all NeoNema utility products, shared brand assets, deploy automation, and platform docs.

- **Production:** [tools.neonema.com](https://tools.neonema.com) — single origin hosting the hub and every tool (`/json/`, `/revealip/`, `/utc/`, …).
- **Privacy:** tools run entirely in the browser. No accounts, no analytics, no ads, no user data stored or relayed.
- **Status:** [docs/STATUS.md](docs/STATUS.md) — what is live, what is open, what is deliberately not built.

## Apps

| App | Path | Description |
|-----|------|-------------|
| Hub | `apps/hub/` | Tab shell for tools.neonema.com |
| RevealIP | `apps/revealip/` | Public IPv4/IPv6 display (edge function for `/api/ip`) |
| UTC | `apps/utc/` | Live local and UTC clocks |
| JSON Toolkit | `apps/json/` | Browser-based JSON validate, diff, JSONPath, converters |

## Packages

| Package | Path | Description |
|---------|------|-------------|
| Brand | `packages/brand/` | Canonical design tokens, header lock, NeoNema logo |
| Utility template | `packages/utility-template/` | Scaffold for new one-page utilities |

## Local development

**Hub preview** (tab bar + iframes, port 8765):

```bash
npm run dev       # fast — no build; serves apps/ directly
npm run preview   # prod-like — builds dist/ then serves it (pre-merge smoke tests)
```

See [docs/ADD_A_TOOL.md](docs/ADD_A_TOOL.md#6-preview-locally) for smoke URLs and the RevealIP `/api/ip` caveat.

**Single-tool dev** (focused work): use `npm run dev` and open the tool path — <http://localhost:8765/json/> or <http://localhost:8765/revealip/>. The hub at `/` still embeds tools in iframes for tab switching; legacy `/#/<tool-id>` opens that hub tab.

## Quality checks

```bash
npm run brand:check
npm run test:json-converters
npm run sync-brand          # copy packages/brand/ into all apps
npm run sync-brand -- json  # sync a single app
```

## Deploy

Production deploys run from GitHub Actions on push to `main`. Local deploys are the fallback and need the **`neonema-tools`** AWS CLI profile — see [docs/INFRA.md](docs/INFRA.md).

```bash
aws configure --profile neonema-tools              # once: credentials for tools account
cp deploy.config.prod.json deploy.config.json      # once: then add "awsProfile": "neonema-tools"
npm run build                                      # assemble dist/
npm run deploy -- platform --dry-run
npm run deploy -- platform
npm run deploy:edge -- platform   # only when a cloudfront/*.js function changes
```

See [docs/DEPLOY.md](docs/DEPLOY.md).

## Documentation

- [Status](docs/STATUS.md) — what is live, what is open, what we are not building
- [Architecture](docs/ARCHITECTURE.md) — single-origin model, static-only rules, edge functions, tab routing
- [Add a tool](docs/ADD_A_TOOL.md) — scaffold, register, preview, pre-ship checks
- [Deploy](docs/DEPLOY.md) — CI, local fallback, edge function publishing
- [Infrastructure](docs/INFRA.md) — AWS accounts, DNS, rebuild notes
- [AGENTS.md](AGENTS.md) — agent instructions and product rules

## Adding a new utility

Follow [docs/ADD_A_TOOL.md](docs/ADD_A_TOOL.md). A tool is not live until it is registered in `apps/hub/hub.config.json`, `scripts/build.mjs`, and the edge redirect function — the hub does not discover apps automatically.

```bash
npm run scaffold -- <tool-id> "<Tool Label>"
```
