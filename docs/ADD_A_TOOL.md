# Add a tool

End-to-end runbook for shipping a new utility: scaffold → implement → register → preview → pre-ship checks → deploy.

**The hub does not auto-discover apps.** A tool is invisible until it is registered in `hub.config.json`, `scripts/build.mjs`, and (for local preview) `scripts/dev.mjs`.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md), [AGENTS.md](../AGENTS.md).

---

## 1. Create the app from the template

```bash
npm run scaffold -- <tool-id> "<Tool Label>"
```

Or manually — copy the template and sync brand assets so `brand-tokens.css`, `NeoNema.png`, and the locked header match `packages/brand/`:

```bash
cp -R packages/utility-template apps/<tool-id>
npm run sync-brand -- <tool-id>
```

The scaffold creates the app only. Steps 3–4 are always manual.

## 2. Implement the tool

| File | What to change |
|------|----------------|
| `public/index.html` | `<title>`, meta description, headline copy, and the `rel="canonical"` href (`/<tool-id>/`). Keep the NeoNema-only header; do not add a tool logo. |
| `public/app.js` | Tool logic — browser-only, no NeoNema APIs, no third-party scripts |
| `public/styles.css` | Layout only; leave brand tokens and the locked header block untouched |
| `public/privacy-policy.html` | Real privacy copy for this tool, not template placeholders |
| `public/terms.html` | Real terms for this tool |

Palette and header rules: [AGENTS.md](../AGENTS.md). Run `npm run brand:check` after edits.

## 3. Register in the build

Add an entry to the `APPS` array in `scripts/build.mjs`:

```javascript
{ label: "<tool-id>", source: "apps/<tool-id>/public", dest: "<tool-id>" },
```

This copies the tool to `dist/<tool-id>/` so both the public path and the hub iframe can load `/<tool-id>/index.html`. The build also regenerates `sitemap.xml` from `hub.config.json`.

For fast local dev (`npm run dev`), add a matching mount in `scripts/dev.mjs` `MOUNTS`:

```javascript
{ mount: "/<tool-id>", dir: "apps/<tool-id>/public" },
```

`npm run preview` needs only the `build.mjs` entry.

## 4. Register the hub tab

Add a tool object to `apps/hub/hub.config.json`:

```json
{
  "id": "<tool-id>",
  "label": "Human Label",
  "path": "/<tool-id>/index.html"
}
```

Tabs render from this config at runtime — never add per-tool markup to the hub HTML. Set `"defaultTool"` if this tab should open at `/` when no tool is selected. Optionally add the tool to the hub `noscript` link list in `apps/hub/public/index.html`.

The edge function only rewrites directories to `index.html` — **no per-tool redirect list**. After editing `apps/hub/cloudfront/uri-rewrite-function.js` for other reasons, republish with `npm run deploy:edge -- platform`.

---

## 5. Preview locally

| Mode | Command | Use when |
|------|---------|----------|
| **Fast dev** | `npm run dev` | Iterating on hub tabs, styles, or tool UI — no build step |
| **Prod-like** | `npm run preview` | Pre-merge smoke tests — builds `dist/` and serves the exact tree CI deploys |

Hub preview runs on port **8765** (`PORT=9000 npm run dev` to change it).

| URL | Expected |
|-----|----------|
| `http://localhost:8765/` | Hub loads with the default tab from `hub.config.json` |
| `http://localhost:8765/<tool-id>/` | Full tool page (`200`); canonical is this path |
| `http://localhost:8765/#/<tool-id>` | Hub shows that tool tab and clears the hash |
| `http://localhost:8765/<tool-id>/privacy-policy.html` | Legal page loads |

Tab labels should match `hub.config.json`. Hub tabs are real links to `/<tool-id>/`; left-click keeps the hub shell and swaps the iframe.

**RevealIP `/api/ip` caveat:** local preview does not run the CloudFront Function, so IP detection fails unless you mock the endpoint. Test it through deployed CloudFront or the function **Test** tab in the AWS console.

---

## 6. Pre-ship checks

Run before merging.

### Automated

```bash
npm run brand:check
npm run build
npm run test:json-converters   # if the tool has tests
```

`brand:check` verifies palette tokens, the locked header block, and `NeoNema.png` against `packages/brand/`. Headers use the company logo only — no per-tool brand assets.

### Legal pages

Both files must exist and describe what the tool actually does:

```bash
ls apps/<tool-id>/public/privacy-policy.html apps/<tool-id>/public/terms.html
```

- Footer links open both pages.
- Copy names the real product and hostname — no `UtilityName` placeholders.
- Privacy copy states browser-only processing and names anything the tool touches.

### `robots.txt`

Crawlers only read `robots.txt` from the origin root, so **`apps/hub/public/robots.txt`** governs the whole site. A per-tool copy is optional and inert. Never reference legacy domains. Confirm it points at `sitemap.xml`.

### Device / responsive smoke

Check 320×568, 375×667, 390×844, 768×1024, and 1366×768:

- No horizontal scrolling on the main tool view.
- Controls and copy stay readable and tappable.
- Footer links visible, not overlapping.
- Long or wrapping output (IPv6 strings, JSON blobs) stays inside its container.

Worth one pass each on normal network, VPN, and mobile data — RevealIP behaves differently on each.

### Accessibility smoke

- [ ] `<html lang="en">` and a descriptive `<title>`
- [ ] One visible `<h1>`; headings in logical order
- [ ] All controls keyboard reachable (Tab) and activatable (Enter / Space)
- [ ] Icon-only buttons have `aria-label`
- [ ] Form fields have `<label>` or `aria-label`
- [ ] Dynamic status / error messages use `aria-live`
- [ ] Decorative images `alt=""`; meaningful images described
- [ ] Focus states visible on buttons and inputs
- [ ] Contrast readable on brand backgrounds

### Final gate

- [ ] Logic runs in the browser — no `fetch()` to NeoNema-owned APIs unless documented in [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ ] No analytics, ad, or third-party tracking scripts
- [ ] Hub config id and `build.mjs` dest match
- [ ] Canonical URL points at `https://tools.neonema.com/<tool-id>/`
- [ ] Tool appears in built `dist/sitemap.xml`

---

## 7. Ship

Merge to `main` — GitHub Actions builds and deploys. If you changed an edge function, republish:

```bash
npm run deploy:edge -- platform
```

Details and the local deploy fallback: [DEPLOY.md](./DEPLOY.md).

---

## Quick reference

| Concern | Location |
|---------|----------|
| Brand palette & header | `packages/brand/`, [AGENTS.md](../AGENTS.md) |
| Tool template | `packages/utility-template/` |
| Hub tab list | `apps/hub/hub.config.json` |
| Build tree + sitemap | `scripts/build.mjs` → `dist/` |
| Hub routing | `apps/hub/public/app.js` |
| Directory rewrite | `apps/hub/cloudfront/uri-rewrite-function.js` |
