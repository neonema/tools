# Platform status

Where the NeoNema tools platform stands, what is open, and what is deliberately not being built.

**Last updated:** 2026-07-30

---

## Live today


| Thing                  | State                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tools.neonema.com**  | Hub + all tools, single S3 bucket (`neonema-tools-prod`) + one CloudFront distribution (`EGT0I63QAM75Z`) in the NeoNema tools AWS account                                                                             |
| **Tools shipped**      | JSON Toolkit (`/json/`), RevealIP (`/revealip/`), UTC (`/utc/`)                                                                                                                                                       |
| **RevealIP** `/api/ip` | CloudFront Function `revealip-ip-api` on the production distribution — the only edge compute on the platform                                                                                                          |
| **Tool-root URLs**     | CloudFront Function `tools-uri-rewrite` rewrites `/json/`, `/revealip/`, `/utc/` (and other directories) to `index.html` — `200` public pages, not redirects to hash routes                                            |
| **Canonical tags**     | Each tool `index.html` points at `https://tools.neonema.com/<tool-id>/`                                                                                                                                               |
| **Sitemap**            | `sitemap.xml` generated at build from `hub.config.json`; referenced from root `robots.txt`                                                                                                                            |
| **Legacy domains**     | `json-neonema.com`, `revealip-neonema.com`, and both `www` variants should 301 to the matching path URL (Cloudflare). Old per-app AWS accounts closed                                                                  |
| **Deploy**             | Push to `main` → `.github/workflows/deploy-prod.yml` → OIDC role `github-neonema-tools-deploy` → `dist/` synced + invalidated. Local `npm run deploy -- platform` is the fallback                                     |
| **Local preview**      | `npm run dev` (fast) and `npm run preview` (prod-like) on port 8765                                                                                                                                                   |
| **Monetization**       | None. No AdSense, no `ads.txt`, no analytics, no third-party trackers                                                                                                                                                 |


Design decisions that are settled: single origin, iframe tab panels on the hub, path URLs as the public/SEO entry, explicit (non-auto-discovered) tool registration, two AWS accounts (tools vs company).

---



## Open



### 1. Company site cross-links — blocked

`neonema.com` does not currently resolve. Once the company site exists:

- [ ] "Tools" link on neonema.com → `https://tools.neonema.com`
- [ ] Hub footer → `https://neonema.com`
- [ ] Keep tools off the neonema.com apex



### 2. Add vesioning for each page. This will help with tracking deployment as well as some usage analysis.

### 3. Search Console

- [ ] Submit `https://tools.neonema.com/sitemap.xml` in Google Search Console after the path-URL deploy and edge republish land.



### 4. Legacy Cloudflare redirects

- [ ] Point `json-neonema.com` / `revealip-neonema.com` (and `www`) at `/json/` and `/revealip/` instead of `/#/...` (see [INFRA.md](./INFRA.md))



---



## Deliberately not doing


| Thing                                                                           | Why                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hosted staging** (`dev.tools.neonema.com`, dev bucket, `deploy-dev` workflow) | `npm run dev` / `npm run preview` cover pre-merge validation. Revisit only if local preview proves insufficient                                                                |
| **Terraform / CDK for the tools account**                                       | The stack is one bucket, one distribution, two functions, one IAM role — Console setup plus `infra/iam/` policy JSON is proportionate. Revisit if a second environment appears |
| **Path-filtered CI deploys**                                                    | The full build and sync takes seconds; per-prefix filtering is not worth the workflow complexity                                                                               |
| **Ad monetization**                                                             | Focus is traffic and utility, not ad revenue. Ads also contradict the browser-only privacy promise                                                                             |
| **Git history import from the old per-app repos**                               | The monorepo is the source of truth; old repos can be archived as-is                                                                                                           |


---



## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — hosting model, static-only rules, edge functions, tab routing
- [ADD_A_TOOL.md](./ADD_A_TOOL.md) — scaffold, register, preview, pre-ship checks
- [DEPLOY.md](./DEPLOY.md) — CI, local fallback, edge function publishing
- [INFRA.md](./INFRA.md) — AWS accounts, DNS, legacy domains, rebuild notes
- [../AGENTS.md](../AGENTS.md) — agent instructions and product rules
