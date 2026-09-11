# NeoNema Tools

Private, browser-only utilities. Live at **[tools.neonema.com](https://tools.neonema.com)**.

## Why this is public

Every tool runs entirely in your browser. This repository exists so you can verify that instead of trusting it.

How to verify: each tool is plain HTML, CSS, and JS under `apps/<tool>/public/`. There is no server code. The deploy workflow in [`.github/workflows/deploy-prod.yml`](.github/workflows/deploy-prod.yml) copies those files to a CDN unchanged. Every deployed page shows the commit it was built from in its footer, and [`/version.json`](https://tools.neonema.com/version.json) reports the same commit, so you can match what is live against this repository.

## Tools

| Tool | Path | What it does |
|------|------|--------------|
| RevealIP | [`/revealip/`](https://tools.neonema.com/revealip/) | Show your public IPv4 and IPv6 address. No location lookup, no logging |
| UTC | [`/utc/`](https://tools.neonema.com/utc/) | Live local and UTC clocks with your timezone offset and DST status |
| Epoch | [`/epoch/`](https://tools.neonema.com/epoch/) | Convert Unix timestamps to dates and back, in seconds or milliseconds |
| Cron | [`/cron/`](https://tools.neonema.com/cron/) | Build or decode cron schedules with a plain-English explanation and next run times |
| Password | [`/password/`](https://tools.neonema.com/password/) | Generate a cryptographically random password with length and symbol-group controls |
| JSON Toolkit | [`/json/`](https://tools.neonema.com/json/) | Validate, format, diff, query, and convert JSON |
| Column to List | [`/column-to-list/`](https://tools.neonema.com/column-to-list/) | Turn a column of text into a comma-separated list, or split a list back into lines |
| Mermaid Preview | [`/mermaid/`](https://tools.neonema.com/mermaid/) | Render Mermaid and Markdown diagrams from pasted source |
| Word/Token Counter | [`/word-token-counter/`](https://tools.neonema.com/word-token-counter/) | Count words, characters, and estimated LLM tokens as you type |
| Base64 | [`/base64/`](https://tools.neonema.com/base64/) | Encode text to Base64 or decode Base64 to text |
| URL Encode | [`/url-encode/`](https://tools.neonema.com/url-encode/) | Percent-encode or decode strings |
| JWT Decoder | [`/jwt/`](https://tools.neonema.com/jwt/) | Decode a JWT header and payload without the token leaving your device |

The hub at `/` is a tab shell that loads each tool in an iframe. Tools are registered by hand in [`apps/hub/hub.config.json`](apps/hub/hub.config.json).

## Run locally

No dependencies to install. Node 22 or newer.

```bash
npm run dev       # http://localhost:8765/  (serves apps/ directly)
npm run preview   # builds dist/ and serves the exact tree CI deploys
```

Open a tool at its path, for example `http://localhost:8765/json/`. RevealIP's `/api/ip` is a CloudFront Function and does not run locally.

## How deploys work

A push to `main` runs the checks, builds `dist/`, and syncs it to S3 behind CloudFront through a GitHub OIDC role that only this repository's `main` branch can assume. There are no stored credentials anywhere. Details in [docs/DEPLOY.md](docs/DEPLOY.md).

## Contributing

Bug reports and tool requests are welcome as issues. Pull requests by prior discussion only. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ADD_A_TOOL.md](docs/ADD_A_TOOL.md). Security or privacy findings: [SECURITY.md](SECURITY.md).

## Privacy commitments

- No analytics, no trackers, no ads, no consent banners
- No accounts, no signups
- Nothing you paste, type, or upload leaves your browser
- One documented exception: RevealIP's `/api/ip` edge function returns the caller's IP address to the browser and stores nothing ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#edge-functions))

## Documentation

- [docs/STATUS.md](docs/STATUS.md): what is live
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): single-origin model, static-only rules, edge functions, tab routing
- [docs/ADD_A_TOOL.md](docs/ADD_A_TOOL.md): scaffold, register, preview, pre-ship checks
- [docs/DEPLOY.md](docs/DEPLOY.md): CI, local fallback, edge function publishing
- [docs/INFRA.md](docs/INFRA.md): AWS account shape, DNS, rebuild notes
- [AGENTS.md](AGENTS.md): rules for agents and contributors

## License

Source-available, all rights reserved. You may read, download, and run this code to verify what it does. Any other use requires written permission or a commercial license. See [LICENSE](LICENSE). The NeoNema name and logo are trademarks and are not licensed at all; see [TRADEMARK.md](TRADEMARK.md).
