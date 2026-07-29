# Legacy domain cutover runbook

How **json-neonema.com** and **revealip-neonema.com** were migrated to the unified hub at **tools.neonema.com**, and what remains.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the hosting layout and [STATUS.md](../STATUS.md) for current platform state.

---

## Status

| Step | State |
|------|-------|
| Canonical redirect targets defined | Done |
| Cloudflare 301 redirects (apex + `www`) | Live |
| CloudFront redirect fallback | Not used — Cloudflare path chosen |
| Cold-cache verification | Done |
| Canonical tags in tool HTML | **Done** — hub-hash canonicals on each tool `index.html` |
| Decommission legacy AWS stacks | **Done** — old per-app AWS accounts closed |

---

## Redirect map

Every legacy hostname **301**s to the hub hash route for the matching tool.

| Source hostname | Target |
|-----------------|--------|
| `json-neonema.com`, `www.json-neonema.com` | `https://tools.neonema.com/#/json` |
| `revealip-neonema.com`, `www.revealip-neonema.com` | `https://tools.neonema.com/#/revealip` |

Rules: status `301`; no path mapping (all legacy paths collapse to the tool's tab); query strings not preserved; implemented at the Cloudflare edge so traffic never reaches the old S3/CloudFront origins.

### Cloudflare configuration

Redirect Rules, one per zone:

**Zone `json-neonema.com`**
- Match: `(http.host eq "json-neonema.com") or (http.host eq "www.json-neonema.com")`
- Action: static redirect **301** → `https://tools.neonema.com/#/json`
- Preserve query string: off

**Zone `revealip-neonema.com`**
- Match: `(http.host eq "revealip-neonema.com") or (http.host eq "www.revealip-neonema.com")`
- Action: static redirect **301** → `https://tools.neonema.com/#/revealip`

Dashboard path: **Rules → Overview → Create rule → Redirect Rule**.

Both zones need a proxied `www` CNAME to the apex for the `www` variants to resolve.

### Verification

```bash
for host in json-neonema.com www.json-neonema.com revealip-neonema.com www.revealip-neonema.com; do
  echo "=== $host ==="
  curl -sI "https://$host/" | grep -iE "HTTP/|location:"
done
```

Each should return `301` with a `location:` matching the table above. Confirm once from an incognito window with a cold cache.

---

## Canonical tags & `robots.txt`

**Done.** Each tool `index.html` ships a hub-hash canonical:

```html
<link rel="canonical" href="https://tools.neonema.com/#/json" />      <!-- JSON -->
<link rel="canonical" href="https://tools.neonema.com/#/revealip" />  <!-- RevealIP -->
```

`robots.txt` is only honored at the origin root — `apps/hub/public/robots.txt` is the file that matters; per-tool copies under `/json/` and `/revealip/` are inert. New tools get the same pattern from `packages/utility-template` (`#/TOOL_ID` → replace with the real id).

Verify after deploy:

```bash
grep -rE "canonical|json-neonema\.com|revealip-neonema\.com" apps/json/public apps/revealip/public
curl -s "https://tools.neonema.com/json/index.html" | grep -i canonical
```

No legacy hostnames should appear in tool HTML.

---

## Decommission legacy AWS stacks

**Done.** Old per-app AWS accounts closed. Legacy hostnames continue to 301 via Cloudflare; the only AWS stack is the tools account (`neonema-tools-prod`, distribution `EGT0I63QAM75Z`).

---

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — single-origin model
- [STATUS.md](../STATUS.md) — platform status and open items
- [deploy/cloudflare-dns.md](../deploy/cloudflare-dns.md) — DNS → CloudFront
- [infra/README.md](../infra/README.md) — AWS accounts and `neonema-tools` profile
