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
| Canonical tags in tool HTML | **Open** — see below |
| Decommission legacy AWS stacks | **Open** — soak elapsed 2026-07-29 |

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

**Open.** Search engines should consolidate on `tools.neonema.com`.

`robots.txt` is only honored at the origin root — `apps/hub/public/robots.txt` is the file that matters; per-tool copies under `/json/` and `/revealip/` are inert.

For canonicals, add to each tool's `index.html` `<head>`:

```html
<link rel="canonical" href="https://tools.neonema.com/#/json" />      <!-- JSON -->
<link rel="canonical" href="https://tools.neonema.com/#/revealip" />  <!-- RevealIP -->
```

Verify after deploy:

```bash
grep -rE "canonical|json-neonema\.com|revealip-neonema\.com" apps/json/public apps/revealip/public
curl -s "https://tools.neonema.com/json/index.html" | grep -i canonical
```

No legacy hostnames should appear in tool HTML.

---

## Decommission legacy AWS stacks

**Open.** The 30-day soak since the 2026-06-29 cutover elapsed on 2026-07-29.

### Pre-delete checklist

- [ ] Redirect verification above still passes for all four hostnames
- [ ] No DNS A/AAAA/CNAME records pointing at old CloudFront distribution IDs
- [ ] Optional: final S3 bucket backup

### Delete order, per legacy AWS account

1. **Disable** the CloudFront distribution, wait for status *Deployed*
2. **Delete** the distribution
3. **Empty and delete** the S3 bucket
4. **Remove** unused ACM certificates and IAM deploy users

```bash
# Confirm account context first
aws sts get-caller-identity --profile <legacy-profile>
aws s3 ls
aws cloudfront list-distributions --query "DistributionList.Items[].{Id:Id,Aliases:Aliases.Items}"
```

Do **not** delete the NeoNema tools stack (`neonema-tools-prod`, distribution `EGT0I63QAM75Z`).

---

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — single-origin model
- [STATUS.md](../STATUS.md) — platform status and open items
- [deploy/cloudflare-dns.md](../deploy/cloudflare-dns.md) — DNS → CloudFront
- [infra/README.md](../infra/README.md) — AWS accounts and `neonema-tools` profile
