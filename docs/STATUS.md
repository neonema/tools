# Platform status

Where the NeoNema tools platform stands, what is open, and what is deliberately not being built.

**Last updated:** 2026-07-29

---

## Live today

| Thing | State |
|-------|-------|
| **tools.neonema.com** | Hub + all tools, single S3 bucket (`neonema-tools-prod`) + one CloudFront distribution (`EGT0I63QAM75Z`) in the NeoNema tools AWS account |
| **Tools shipped** | JSON Toolkit (`#/json`), RevealIP (`#/revealip`) |
| **RevealIP `/api/ip`** | CloudFront Function `revealip-ip-api` on the production distribution — the only edge compute on the platform |
| **Legacy domains** | `json-neonema.com`, `revealip-neonema.com`, and both `www` variants 301 to the matching hub hash route |
| **Deploy** | Push to `main` → `.github/workflows/deploy-prod.yml` → OIDC role `github-neonema-tools-deploy` → `dist/` synced + invalidated. Local `npm run deploy -- platform` is the fallback |
| **Local preview** | `npm run dev` (fast) and `npm run preview` (prod-like) on port 8765 |
| **Monetization** | None. No AdSense, no `ads.txt`, no analytics, no third-party trackers |

Design decisions that are settled: single origin, iframe tab panels, hub-only public URLs, explicit (non-auto-discovered) tool registration, two AWS accounts (tools vs company).

---

## Open

### 1. Tool-root 301 is not live at the edge

`apps/hub/cloudfront/uri-rewrite-function.js` returns a `301` from `/json/` and `/revealip/` to the hub hash route, but production still answers **200** for those paths — the published function version predates that branch. Today the redirect only happens client-side, via the guard script in each tool's `index.html`, so crawlers can still reach two URLs per tool.

Fix: republish the edge functions, then verify.

```bash
npm run deploy:edge -- platform
curl -sI "https://tools.neonema.com/json/" | grep -iE "HTTP/|location:"   # expect 301
```

### 2. Decommission legacy AWS stacks

The 30-day soak since the 2026-06-29 cutover has elapsed. Legacy per-app S3 buckets and CloudFront distributions in the old accounts are still billing and no longer serve traffic.

Before deleting, per legacy account:

- [ ] Apex + `www` redirects still return 301 (see [DOMAIN_CUTOVER.md](./platform/DOMAIN_CUTOVER.md))
- [ ] No DNS records point at the old distribution IDs
- [ ] Optional final bucket backup

Delete order: disable distribution → delete distribution → empty and delete bucket → remove unused ACM certs and IAM deploy users. Never touch `neonema-tools-prod` or the `tools-prod` distribution.

### 3. Canonical tags

No tool ships a `<link rel="canonical">`. Adding hub-hash canonicals consolidates search signals on `tools.neonema.com` — worth doing once the edge 301 above is live. See [DOMAIN_CUTOVER.md](./platform/DOMAIN_CUTOVER.md#canonical-tags--robotstxt).

### 4. Company site cross-links — blocked

`neonema.com` does not currently resolve. Once the company site exists:

- [ ] "Tools" link on neonema.com → `https://tools.neonema.com`
- [ ] Hub footer → `https://neonema.com`
- [ ] Keep tools off the neonema.com apex

---

## Deliberately not doing

| Thing | Why |
|-------|-----|
| **Hosted staging** (`dev.tools.neonema.com`, dev bucket, `deploy-dev` workflow) | `npm run dev` / `npm run preview` cover pre-merge validation. Revisit only if local preview proves insufficient |
| **Terraform / CDK for the tools account** | The stack is one bucket, one distribution, two functions, one IAM role — Console setup plus `infra/iam/` policy JSON is proportionate. Revisit if a second environment appears |
| **Path-filtered CI deploys** | The full build and sync takes seconds; per-prefix filtering is not worth the workflow complexity |
| **Ad monetization** | Focus is traffic and utility, not ad revenue. Ads also contradict the browser-only privacy promise |
| **Sitemap** | Two tools behind hash routes; not yet worth maintaining |
| **Git history import from the old per-app repos** | The monorepo is the source of truth; old repos can be archived as-is |

---

## Related docs

- [platform/ARCHITECTURE.md](./platform/ARCHITECTURE.md) — hosting model, static-only rules, tab routing
- [platform/ADD_A_TOOL.md](./platform/ADD_A_TOOL.md) — how to add a tool
- [platform/TOOL_CHECKLIST.md](./platform/TOOL_CHECKLIST.md) — pre-ship checks
- [platform/PREVIEW.md](./platform/PREVIEW.md) — local preview modes
- [platform/DOMAIN_CUTOVER.md](./platform/DOMAIN_CUTOVER.md) — legacy redirects and decommission
- [deploy/](./deploy/) — AWS, Cloudflare, and deploy runbooks
- [infra/README.md](./infra/README.md) — AWS accounts and CLI profile
