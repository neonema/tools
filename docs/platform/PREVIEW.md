# Local preview

Pre-production validation for the NeoNema tools hub and tool subtrees. No AWS or hosted staging URL — preview runs on **localhost** before merging to `main`.

Related: [ADD_A_TOOL.md](./ADD_A_TOOL.md), [TOOL_CHECKLIST.md](./TOOL_CHECKLIST.md), [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Preview modes

| Mode | Command | Output | Use when |
|------|---------|--------|----------|
| **Fast dev** | `npm run dev` | Serves `apps/hub/public` + tool `public/` folders directly | Iterating on hub tabs, styles, or tool UI — no build step |
| **Prod-like** | `npm run preview` | Runs `npm run build`, then serves `dist/` | Pre-merge smoke tests — same tree CI deploys to production |
| **Single tool** | `npm run dev:json`, `npm run dev:revealip`, … | Tool at `http://localhost:8080/` | Focused work on one tool without the hub shell |

Default port for hub preview: **8765** (override with `PORT=9000 npm run dev`).

---

## Hub smoke URLs

After `npm run dev` or `npm run preview`:

| URL | Expected |
|-----|----------|
| `http://localhost:8765/` | Hub loads; default tab from `hub.config.json` |
| `http://localhost:8765/#/json` | JSON Toolkit tab active; iframe loads |
| `http://localhost:8765/#/revealip` | RevealIP tab active; iframe loads |
| `http://localhost:8765/json/` | Redirects to `/#/json` (tool `index.html` guard) |
| `http://localhost:8765/revealip/` | Redirects to `/#/revealip` |
| `http://localhost:8765/json/privacy-policy.html` | Legal page loads |

Tab labels and descriptions should match `apps/hub/hub.config.json`.

---

## RevealIP `/api/ip` caveat

RevealIP fetches the viewer IP from `/api/ip`, served in production by a **CloudFront Function**. Local preview does **not** run that edge function:

- `npm run dev` and `npm run preview` — IP detection will fail or show an error unless you mock the endpoint.
- `npm run dev:revealip` — same limitation at `http://localhost:8080/`.

To test IP detection, use deployed CloudFront or the function **Test** tab in the AWS console. See [revealip-cloudfront-function.md](../deploy/revealip-cloudfront-function.md).

---

## Adding a new tool

Register the tool in `scripts/build.mjs` and `apps/hub/hub.config.json` per [ADD_A_TOOL.md](./ADD_A_TOOL.md).

For **fast dev** (`npm run dev`), also add a mount in `scripts/dev.mjs`:

```javascript
{ mount: "/<tool-id>", dir: "apps/<tool-id>/public" },
```

`npm run preview` picks up new tools from the build script only — no `dev.mjs` change needed.

---

## Pre-merge checklist

Before opening a PR that ships hub or tool changes:

```bash
npm run brand:check
npm run preview
```

Then confirm hub tab, redirect, and legal-page checks in [TOOL_CHECKLIST.md](./TOOL_CHECKLIST.md). Cite which preview mode you used in the PR test plan.
