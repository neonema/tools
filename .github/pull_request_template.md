## Summary

<!-- PRs are accepted by prior discussion only. Link the issue. See CONTRIBUTING.md. -->

<!-- What tool or change does this PR add? One or two sentences. -->

-

## New tool checklist

If this PR adds or ships a tool, confirm the steps and pre-ship checks in [docs/ADD_A_TOOL.md](docs/ADD_A_TOOL.md).

- [ ] App created under `apps/<tool-id>/` (scaffold or template copy + `sync-brand`)
- [ ] Tool registered in `scripts/build.mjs`, `scripts/dev.mjs`, and `apps/hub/hub.config.json`
- [ ] `privacy-policy.html` and `terms.html` updated (not template placeholders)
- [ ] Canonical URL points at `https://tools.neonema.com/<tool-id>/`
- [ ] Tool appears in built `dist/sitemap.xml`
- [ ] No analytics, ad, or third-party tracking scripts
- [ ] `npm run brand:check` passes
- [ ] `npm run test:json-converters` and `npm run test:password` pass
- [ ] `npm run build` passes

## Test plan

<!-- How did you verify? npm run dev or npm run preview, hub tab, path URL, device/a11y smoke, etc. -->

- [ ] `npm run preview` (or `npm run dev`) — hub tab loads tool iframe
- [ ] `/<tool-id>/` returns `200` with the full tool page (no redirect to hash)
- [ ] Footer Privacy / Terms links work
