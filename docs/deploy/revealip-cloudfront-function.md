# RevealIP CloudFront Function (`/api/ip`)

RevealIP is the only current app that requires an edge function. The JSON toolkit is fully static.

## Source file

`apps/revealip/cloudfront/ip-api-function.js`

## Platform distribution (`tools.neonema.com`)

On the **unified** production distribution (`platform` in `deploy.config.json`):

| Setting | Value |
|---------|--------|
| Distribution | `tools.neonema.com` (e.g. `EGT0I63QAM75Z`) |
| Path pattern | `/api/ip*` (precedence above default `*`) |
| Function | `revealip-ip-api` on **Viewer request** |
| Cache policy | **CachingDisabled** (dynamic per-visitor response) |

RevealIP at `https://tools.neonema.com/revealip/` calls `/api/ip` on the **same origin** (not a separate RevealIP distribution).

### Directory URLs (`/json/`, `/revealip/`)

Tool root paths redirect to the hub — they are not public landing URLs. CloudFront Function **`tools-uri-rewrite`** (`apps/hub/cloudfront/uri-rewrite-function.js`) on the default `*` behavior returns `301` to `/#/json` or `/#/revealip` for `/json` and `/revealip` directory paths. Tool `index.html` also redirects top-level visits to the hub; iframe embeds (`/json/index.html`) are unchanged.

Publish function code updates:

```bash
# Republish tools-uri-rewrite in the AWS Console, or via CLI (see ARCHITECTURE.md)
```

## First-time setup (AWS Console)

1. **CloudFront** → **Functions** → **Create function**.
2. Name: `revealip-ip-api`.
3. Runtime: **cloudfront-js-2.0**.
4. Paste code from `apps/revealip/cloudfront/ip-api-function.js`.
5. **Save** and **Publish**.

Or create via CLI:

```bash
aws cloudfront create-function \
  --name revealip-ip-api \
  --function-config Comment="RevealIP /api/ip on tools.neonema.com",Runtime=cloudfront-js-2.0 \
  --function-code fileb://apps/revealip/cloudfront/ip-api-function.js \
  --profile neonema-tools
# then publish-function with the returned ETag
```

## Attach to distribution

1. Open the **tools** CloudFront distribution → **Behaviors**.
2. **Create behavior** — path pattern `/api/ip*` (must rank **above** default `*`).
3. Origin: same S3 origin as static files (`neonema-tools-prod`).
4. Cache policy: **CachingDisabled**.
5. Attach `revealip-ip-api` to **Viewer request**.
6. Save and wait for **Deployed**.

## Verify

```bash
curl -sI "https://tools.neonema.com/api/ip" | head -5
curl -s "https://tools.neonema.com/api/ip"
```

Expected: HTTP 200, JSON body with `ipv4`, `ipv6`, `preferred`, and `status: "ok"`.

With **Cloudflare proxied** DNS, the function reads `cf-connecting-ip` for the real visitor IP.

## Local development

`/api/ip` does not work with `npm run dev:revealip` unless you mock the endpoint. Test IP detection through deployed CloudFront or the function **Test** tab in the AWS console.
