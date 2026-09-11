# Contributing

Thanks for looking. This repository is public so that the privacy claims of tools.neonema.com can be verified, not as a community project. The code is under a source-available license (see [LICENSE](LICENSE)), so please read that before investing time.

## What is welcome

- **Bug reports** and **privacy or security findings**. Open an issue using the bug template, or follow [SECURITY.md](SECURITY.md) for anything sensitive.
- **Tool requests**. Open an issue using the tool request template. Say what the tool does and why it fits a browser-only model.
- **Pull requests by prior discussion only.** Open an issue first. Unsolicited PRs may be closed without review. By submitting a PR you agree that NeoNema may use your contribution under the repository license.

## Non-negotiables

Every change must keep these true. `npm run brand:check` enforces most of them.

- Static only: plain HTML, CSS, and JS. No frameworks, no bundlers, no npm runtime packages, no CDN scripts.
- Browser-only processing: no `fetch()` to NeoNema-owned APIs. The one documented exception is RevealIP's `/api/ip` edge function.
- No analytics, no ads, no trackers, no consent banners.
- The NeoNema palette, header lock, and "Private by design." note stay exactly as specified in [AGENTS.md](AGENTS.md).
- Each tool ships `privacy-policy.html` and `terms.html` that describe what the tool actually does.

## Adding a tool

Follow [docs/ADD_A_TOOL.md](docs/ADD_A_TOOL.md). Registration is manual: a tool is invisible until it is listed in `apps/hub/hub.config.json`, `scripts/build.mjs`, and the hub `noscript` list.

## Required checks

```bash
npm run brand:check
npm run test:json-converters
npm run test:password
npm run build
```

## How deploys happen

Maintainers deploy by merging to `main`. GitHub Actions builds `dist/` and syncs it to the CDN through an OIDC role that only this repository's `main` branch can assume. Forks cannot deploy.
