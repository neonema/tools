# Legacy domain cutover runbook

Operational reference for migrating **json-neonema.com** and **revealip-neonema.com** to the unified hub at **tools.neonema.com**.  
See [ARCHITECTURE.md](./ARCHITECTURE.md) for hosting layout and [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) P3 for the checklist.

---

## Cutover status (2026-06)

| Step | Status | Notes |
|------|--------|-------|
| P3.1 Canonical targets | Done | This document |
| P3.2 Cloudflare apex redirects | Done | `301` → hub hash routes |
| P3.3 CloudFront redirect fallback | Skipped | Cloudflare path in use |
| P3.4 Canonical / `robots.txt` | Open | Hub-hash canonicals in tool `index.html` — see [P3.4](#p34--canonical-tags--robotstxt) |
| P3.5 Cold-cache verification | Done | Apex `curl` + incognito |
| P3.6 Search / `ads.txt` | Done | Root `ads.txt` live; AdSense removal in [platform backlog](../TOOLS_PLATFORM_PLAN.md#remove-adsense-backlog) |
| P3.7 Runbook | Done | This file |
| P3.8 Decommission legacy AWS | Pending | After **30-day soak** — see [P3.8](#p38--decommission-legacy-aws-post-soak) |

**Platform backlog (not blocking):** `www` legacy hostnames; remove Google AdSense — [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md#platform-backlog-not-blocking-current-sprints).

---

## P3.1 — Canonical redirect targets

Every legacy apex hostname **301** redirects to the hub **hash route** for the matching tool.

| Source hostname | Redirect target | Status |
|-----------------|-----------------|--------|
| `https://json-neonema.com` | `https://tools.neonema.com/#/json` | Live |
| `https://revealip-neonema.com` | `https://tools.neonema.com/#/revealip` | Live |
| `https://www.json-neonema.com` | `https://tools.neonema.com/#/json` | Backlog |
| `https://www.revealip-neonema.com` | `https://tools.neonema.com/#/revealip` | Backlog |

### Rules

- **Status code:** `301` (permanent).
- **Path mapping:** Not required — all legacy paths collapse to the same hub tab.
- **Query strings:** Not preserved (legacy sites did not use query routing).
- **Implementation:** Cloudflare Redirect Rules or Bulk Redirects at the edge. Traffic must not reach old S3/CloudFront origins after cutover.

### Verification

```bash
grep -E "revealip-neonema|json-neonema|#/revealip|#/json" \
  docs/TOOLS_PLATFORM_PLAN.md docs/platform/DOMAIN_CUTOVER.md
```

---

## P3.2 — Cloudflare redirects

**Path chosen:** Cloudflare edge **301** (not per-domain CloudFront redirect distributions).

### Redirect Rules (per zone)

**Zone `json-neonema.com`**

- Match: `(http.host eq "json-neonema.com") or (http.host eq "www.json-neonema.com")`
- Action: Static redirect **301** → `https://tools.neonema.com/#/json`
- Preserve query string: Off

**Zone `revealip-neonema.com`**

- Match: `(http.host eq "revealip-neonema.com") or (http.host eq "www.revealip-neonema.com")`
- Action: Static redirect **301** → `https://tools.neonema.com/#/revealip`

Dashboard: **Rules → Overview → Create rule → Redirect Rule** (label varies by account).

### Bulk Redirects (alternative)

Two list entries with **Subpath matching: On**, **Include subdomains: On**, **Preserve path suffix: Off**:

| Source URL | Target URL |
|------------|------------|
| `https://json-neonema.com/` | `https://tools.neonema.com/#/json` |
| `https://revealip-neonema.com/` | `https://tools.neonema.com/#/revealip` |

### Apex verification (required)

```bash
curl -sI "https://json-neonema.com/" | grep -iE "HTTP/|location:"
curl -sI "https://revealip-neonema.com/" | grep -iE "HTTP/|location:"
```

Expected: `HTTP/2 301` and matching `location:` headers.

### `www` (backlog)

Apex redirects are sufficient for cutover. When picking up `www`:

1. Add proxied **CNAME** `www` → zone apex in each Cloudflare zone.
2. Re-run: `curl -4 -sI "https://www.json-neonema.com/"` (and revealip).
3. If `dig` works but `curl` fails, flush macOS DNS cache or force IPv4 (`curl -4`).

---

## P3.3 — CloudFront redirect fallback

**Skipped.** Use only if legacy DNS cannot use Cloudflare redirects. See [TOOLS_PLATFORM_PLAN.md](../TOOLS_PLATFORM_PLAN.md) P3.3.

---

## P3.4 — Canonical tags & `robots.txt`

Search engines should consolidate on **tools.neonema.com**, not legacy hostnames.

### Tool HTML

Add to each tool `index.html` `<head>`:

```html
<!-- JSON -->
<link rel="canonical" href="https://tools.neonema.com/#/json" />

<!-- RevealIP -->
<link rel="canonical" href="https://tools.neonema.com/#/revealip" />
```

Optional `robots.txt` comment at top of each tool `public/robots.txt`:

```
# Canonical public URL: https://tools.neonema.com/#/json
```

### Verification

```bash
grep -rE "canonical|json-neonema\.com|revealip-neonema\.com" apps/json/public apps/revealip/public
curl -s "https://tools.neonema.com/json/index.html" | grep -i canonical
curl -s "https://tools.neonema.com/revealip/index.html" | grep -i canonical
```

No legacy hostnames in output; canonical URLs use `tools.neonema.com`.

Deploy after changes: `npm run deploy -- platform`

---

## P3.5 — Cold-cache redirect test

Confirms redirects work without a cached **200** from the old origin.

```bash
curl -sI "https://json-neonema.com/" -H "Cache-Control: no-cache" | grep -iE "HTTP/|location:"
curl -sI "https://revealip-neonema.com/" -H "Cache-Control: no-cache" | grep -iE "HTTP/|location:"
```

**Browser (incognito):**

1. `https://json-neonema.com` → JSON tab on `tools.neonema.com`
2. `https://revealip-neonema.com` → RevealIP tab
3. Old bookmarks still redirect

**Phase sign-off loop:**

```bash
for host in json-neonema.com revealip-neonema.com; do
  echo "=== $host ==="
  curl -sI "https://$host/" | grep -iE "HTTP/|location:"
done
```

---

## P3.6 — Search Console & `ads.txt`

Sites are **not monetized**; AdSense removal is [platform backlog](../TOOLS_PLATFORM_PLAN.md#remove-adsense-backlog). Root `ads.txt` remains for cutover compatibility until removal.

### `ads.txt` (unified origin)

| File | URL |
|------|-----|
| `apps/hub/public/ads.txt` | `https://tools.neonema.com/ads.txt` |

```bash
curl -sI "https://tools.neonema.com/ads.txt" | grep -iE "HTTP/|content-type:"
curl -s "https://tools.neonema.com/ads.txt"
```

Expected: **200**, `text/plain`, publisher line present.

### Search Console (manual)

1. Add property `https://tools.neonema.com`
2. Verify via Cloudflare DNS TXT or HTML tag
3. No `sitemap.xml` in repo today — add later if needed
4. Legacy properties: keep during soak or use Change of address

Details: [adsense.md](../deploy/adsense.md#g-platform-cutover--toolsneonemacom-p36)

---

## P3.8 — Decommission legacy AWS (post-soak)

**Earliest:** 30 days after stable apex redirects (no failures, no support tickets).

### Pre-delete checklist

- [ ] 30+ days without redirect failures
- [ ] Apex `curl` tests still pass (see [P3.5](#p35--cold-cache-redirect-test))
- [ ] No DNS A/AAAA/CNAME records pointing at old CloudFront distribution IDs
- [ ] Optional: final S3 bucket backup
- [ ] `www` backlog resolved or explicitly abandoned
- [ ] AdSense / GSC legacy properties cleaned up (or AdSense removal backlog complete)

### Delete order (per legacy AWS account)

1. **Disable** CloudFront distribution (wait until Deployed / disabled)
2. **Delete** CloudFront distribution
3. **Empty and delete** S3 bucket
4. **Remove** unused ACM certs and IAM deploy users if applicable

```bash
# Confirm account context first
aws sts get-caller-identity --profile <legacy-profile>
aws s3 ls
aws cloudfront list-distributions --query "DistributionList.Items[].{Id:Id,Aliases:Aliases.Items}"
```

Do **not** delete the **NeoNema tools** account stack (`neonema-tools-prod`, tools-prod CloudFront).

---

## Quick reference

| Hostname | Role |
|----------|------|
| `tools.neonema.com` | Production hub + tools (canonical) |
| `dev.tools.neonema.com` | Staging |
| `json-neonema.com` | Legacy → `/#/json` |
| `revealip-neonema.com` | Legacy → `/#/revealip` |
| `neonema.com` | Company site (separate repo / AWS account) |

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — single-origin model
- [deploy/cloudflare-dns.md](../deploy/cloudflare-dns.md) — DNS → CloudFront
- [deploy/adsense.md](../deploy/adsense.md) — `ads.txt` / Search Console (AdSense optional / removal backlog)
- [infra/README.md](../infra/README.md) — AWS accounts and `neonema-tools` profile
