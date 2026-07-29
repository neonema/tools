# Add a New Tool — Agent & Contributor Guide

Canonical checklist for adding a utility to the NeoNema tools platform.  
**Read this when scaffolding a new tool** — the hub does **not** auto-discover apps; an agent or contributor registers each tool explicitly.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md), [LLM_PRODUCT_RULES.md](../../LLM_PRODUCT_RULES.md), `AGENTS.md`.

---

## Design intent

- Each tool is a **static one-page app** under `apps/<tool-id>/public/`.
- The hub (`apps/hub/`) shows tools as **tabs** driven by `hub.config.json`.
- Adding a tool means creating the app **and** wiring it into the hub config and build script. There is no filesystem scan or auto-append step.

---

## Checklist

### 1. Create the app from template

```bash
npm run scaffold -- <tool-id> "<Tool Label>"
# or manually:
cp -R packages/utility-template apps/<tool-id>
npm run sync-brand -- <tool-id>
```

Or copy manually and run `sync-brand` so `brand-tokens.css`, `NeoNema.png`, and the locked header match `packages/brand/`.

### 2. Implement the tool

| File | What to change |
|------|----------------|
| `apps/<tool-id>/public/index.html` | `<title>`, meta description, headline copy; set `HUB_TOOL_ID` and the `rel="canonical"` href (`#/<tool-id>`) |
| `apps/<tool-id>/public/app.js` | Tool logic (browser-only; no NeoNema APIs) |
| `apps/<tool-id>/public/styles.css` | Layout only — keep brand tokens and locked header unchanged |
| `apps/<tool-id>/public/privacy-policy.html` | Tool-specific privacy copy |
| `apps/<tool-id>/public/terms.html` | Tool-specific terms copy |

Follow the palette and header rules in `LLM_PRODUCT_RULES.md`. Run `npm run brand:check` after edits.

### 3. Register in the platform build

Add an entry to the `APPS` array in `scripts/build.mjs`:

```javascript
{ label: "<tool-id>", source: "apps/<tool-id>/public", dest: "<tool-id>" },
```

This copies the tool into `dist/<tool-id>/` so the hub iframe can load `/<tool-id>/index.html` and assets are served from the unified origin.

For **fast local dev** (`npm run dev`), add a matching mount in `scripts/dev.mjs` `MOUNTS`:

```javascript
{ mount: "/<tool-id>", dir: "apps/<tool-id>/public" },
```

`npm run preview` only needs the `build.mjs` entry. See [PREVIEW.md](./PREVIEW.md).

### 4. Register a hub tab

Add a tool object to `apps/hub/hub.config.json`:

```json
{
  "id": "<tool-id>",
  "label": "Human Label",
  "path": "/<tool-id>/index.html"
}
```

The hub shell (`apps/hub/public/index.html` and `app.js`) is **shared** — do not add per-tool tabs in hub HTML. Tabs are rendered from config at runtime.

Optional: set `"defaultTool"` if this tab should open on `/` with no hash.

### 5. Verify and deploy

Complete the pre-ship checks in [TOOL_CHECKLIST.md](./TOOL_CHECKLIST.md), then:

```bash
npm run brand:check
npm run preview
```

Browser checks (see [PREVIEW.md](./PREVIEW.md)):

- `http://localhost:8765/#/<tool-id>` — tab active, iframe loads the tool
- `http://localhost:8765/<tool-id>/` — redirects to `/#/<tool-id>` (not a standalone landing page)
- `npm run dev:<tool-id>` (if added) — tool still works at `http://localhost:8080/` for focused development

```bash
npm run deploy -- platform
```

---

### 6. Add the tool root to the edge redirect

`apps/hub/cloudfront/uri-rewrite-function.js` 301s tool root paths to the hub. Add the new id to its match list:

```javascript
var hubToolMatch = uri.match(/^\/(json|revealip|<tool-id>)\/?$/);
```

Then republish: `npm run deploy:edge -- platform`. Skipping this leaves the tool reachable at a second public URL.

---

## Edge exceptions

Do **not** add CloudFront Functions, Lambdas, or NeoNema APIs unless explicitly requested and documented in `ARCHITECTURE.md`. The only current exception is RevealIP `/api/ip`.

Likewise: no analytics, ad, or tracking scripts in a new tool. See [LLM_PRODUCT_RULES.md](../../LLM_PRODUCT_RULES.md).

---

## Quick reference

| Concern | Location |
|---------|----------|
| Brand palette & header | `packages/brand/`, `LLM_PRODUCT_RULES.md` |
| Tool template | `packages/utility-template/` |
| Hub tab list | `apps/hub/hub.config.json` |
| Build / deploy tree | `scripts/build.mjs` → `dist/` |
| Hub routing (hash + iframe) | `apps/hub/public/app.js` |
| Agent defaults | `AGENTS.md` |
| Pre-ship checklist | `docs/platform/TOOL_CHECKLIST.md` |
| Local preview | `docs/platform/PREVIEW.md` |
