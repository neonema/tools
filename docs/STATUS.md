# Platform status

What is live on `tools.neonema.com`. Roadmap and priorities are maintained privately; this file only records the current state.

**Last updated:** 2026-09-11

---

## Live

| Thing | State |
|-------|-------|
| **tools.neonema.com** | Hub plus every tool, served from one S3 bucket and one CloudFront distribution in the NeoNema tools AWS account |
| **Tools shipped** | RevealIP, UTC, Epoch, Cron, Password, JSON Toolkit, Column to List, Mermaid Preview, Word/Token Counter, Base64, URL Encode, JWT Decoder |
| **RevealIP `/api/ip`** | CloudFront Function `revealip-ip-api`. The only edge compute on the platform; returns the caller's IP and stores nothing |
| **Tool-root URLs** | CloudFront Function `tools-uri-rewrite` rewrites `/<tool-id>/` to `index.html`, so every tool is a `200` public page |
| **Canonical tags** | Each tool `index.html` points at `https://tools.neonema.com/<tool-id>/` |
| **Sitemap** | `sitemap.xml` generated at build from `hub.config.json`; referenced from root `robots.txt` |
| **Build stamp** | Every page footer shows the deployed commit; `/version.json` reports commit and build time |
| **Deploy** | Push to `main` → `.github/workflows/deploy-prod.yml` → OIDC role → `dist/` synced and invalidated |
| **Local preview** | `npm run dev` (fast) and `npm run preview` (prod-like) on port 8765 |
| **Monetization** | None. No ads, no analytics, no trackers |

Settled design decisions: single origin, iframe tab panels on the hub, path URLs as the public entry, explicit (non-auto-discovered) tool registration, separate AWS accounts for tools and the company site.

## Not planned

| Thing | Why |
|-------|-----|
| **Hosted staging** | `npm run dev` and `npm run preview` cover pre-merge validation |
| **Terraform / CDK** | One bucket, one distribution, two functions, one IAM role. Console setup plus `infra/iam/` policy JSON is proportionate |
| **Ad monetization or analytics** | Contradicts the browser-only privacy promise |

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md): hosting model, static-only rules, edge functions, tab routing
- [ADD_A_TOOL.md](./ADD_A_TOOL.md): scaffold, register, preview, pre-ship checks
- [DEPLOY.md](./DEPLOY.md): CI, local fallback, edge function publishing
- [INFRA.md](./INFRA.md): AWS account shape, DNS, rebuild notes
- [../AGENTS.md](../AGENTS.md): agent instructions and product rules
