## Summary

<!-- What tool or change does this PR add? One or two sentences. -->

-

## New tool checklist

If this PR adds or ships a tool, confirm the steps in [docs/platform/ADD_A_TOOL.md](docs/platform/ADD_A_TOOL.md) and the pre-ship pass in [docs/platform/TOOL_CHECKLIST.md](docs/platform/TOOL_CHECKLIST.md).

- [ ] App created under `apps/<tool-id>/` (scaffold or template copy + `sync-brand`)
- [ ] Tool registered in `scripts/build.mjs` and `apps/hub/hub.config.json`
- [ ] `privacy-policy.html` and `terms.html` updated (not template placeholders)
- [ ] `robots.txt` present in `apps/<tool-id>/public/`
- [ ] `HUB_TOOL_ID` in `index.html` matches hub config
- [ ] `npm run brand:check` passes
- [ ] `npm run build` passes

## Test plan

<!-- How did you verify? See docs/platform/PREVIEW.md — npm run dev or npm run preview, hub tab, redirect, device/a11y smoke, etc. -->

- [ ] `npm run preview` (or `npm run dev`) — hub tab loads tool iframe
- [ ] `/<tool-id>/` redirects to `/#/<tool-id>`
- [ ] Footer Privacy / Terms links work
