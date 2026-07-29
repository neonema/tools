# Tool Pre-Ship Checklist

Run this **before merging or deploying** a new or updated tool.  
Use after completing the steps in [ADD_A_TOOL.md](./ADD_A_TOOL.md).

---

## Automated checks

```bash
npm run brand:check
npm run build
```

Both must pass. `brand:check` verifies palette tokens, locked header CSS, and `NeoNema.png` match `packages/brand/`.

---

## Legal pages

Each tool subtree must ship:

| File | Requirement |
|------|-------------|
| `apps/<tool-id>/public/privacy-policy.html` | Tool-specific privacy copy (not template placeholders). State that processing is browser-only and name anything the tool touches. |
| `apps/<tool-id>/public/terms.html` | Tool-specific terms of service. |

**Verify:**

```bash
ls apps/<tool-id>/public/privacy-policy.html apps/<tool-id>/public/terms.html
```

- Footer links on `index.html` open both pages.
- Legal pages use the same brand styles and link back to the tool.
- Product name and hostname in copy match the shipped tool (not `UtilityName` placeholders).

---

## `robots.txt`

Crawlers only read `robots.txt` from the origin root, so **`apps/hub/public/robots.txt`** is the file that governs the whole site:

```txt
User-agent: *
Allow: /
```

A per-tool `apps/<tool-id>/public/robots.txt` is optional and inert — include one only for parity when a tool is also served standalone. Never reference legacy domains (`json-neonema.com`, `revealip-neonema.com`).

---

## Hub integration

Prod-like preview (builds `dist/` then serves on port 8765):

```bash
npm run preview
```

For fast iteration without a build step, use `npm run dev` instead. See [PREVIEW.md](./PREVIEW.md).

| Check | Expected |
|-------|----------|
| `http://localhost:8765/#/<tool-id>` | Hub tab active; iframe loads the tool |
| `http://localhost:8765/<tool-id>/` | Redirects to `/#/<tool-id>` (not a standalone landing page) |
| `http://localhost:8765/<tool-id>/privacy-policy.html` | Legal page loads inside or outside iframe as designed |
| Tab label | Matches `apps/hub/hub.config.json` |

Canonical URL (production SEO) in the tool's `index.html`:

```html
<link rel="canonical" href="https://tools.neonema.com/#/<tool-id>" />
```

See [DOMAIN_CUTOVER.md](./DOMAIN_CUTOVER.md#canonical-tags--robotstxt).

---

## Device / responsive smoke

Test the tool UI at these widths (browser devtools or real devices):

| Viewport | Role |
|----------|------|
| 320 × 568 | Small phone |
| 375 × 667 | Standard phone |
| 390 × 844 | Modern phone |
| 768 × 1024 | Tablet portrait |
| 1366 × 768 | Desktop |

**On each viewport, confirm:**

- No horizontal scrolling on the main tool view.
- Primary controls and copy remain readable and tappable.
- Footer links (Privacy, Terms) are visible and do not overlap content.
- Long or wrapping output (IPv6 strings, JSON blobs) stays inside its container.

Also worth one pass each: normal network, VPN on, and mobile data — RevealIP in particular behaves differently on each.

---

## Accessibility smoke

Quick pass — not a full audit:

- [ ] Page has `<html lang="en">` and a descriptive `<title>`.
- [ ] One visible `<h1>` describes the tool; section headings use a logical order.
- [ ] All interactive controls are keyboard reachable (Tab) and activatable (Enter / Space).
- [ ] Icon-only buttons have `aria-label` (or visible text).
- [ ] Form fields have associated `<label>` elements or `aria-label`.
- [ ] Status / error messages use `aria-live="polite"` (or similar) where content updates dynamically.
- [ ] Decorative images use empty `alt=""` or `aria-hidden="true"`; meaningful images have descriptive `alt` text.
- [ ] Focus states are visible on buttons and inputs (do not remove outline without a replacement).
- [ ] Color contrast is readable on brand backgrounds (avoid light-gray-on-white for body copy).

---

## Platform constraints (final gate)

- [ ] Tool logic runs in the browser — no `fetch()` to NeoNema-owned APIs unless documented in [ARCHITECTURE.md](./ARCHITECTURE.md).
- [ ] No analytics, ad, or third-party tracking scripts.
- [ ] Tool root path added to `apps/hub/cloudfront/uri-rewrite-function.js` and republished.
- [ ] `HUB_TOOL_ID` in `index.html` matches the tool id in `hub.config.json` and `build.mjs`.
- [ ] `npm run brand:check` still passes after all edits.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [ADD_A_TOOL.md](./ADD_A_TOOL.md) | Scaffold, implement, register in hub + build |
| [PREVIEW.md](./PREVIEW.md) | `npm run dev` vs `npm run preview`, smoke URLs |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Static-only rules, tab routing, edge exceptions |
| [DOMAIN_CUTOVER.md](./DOMAIN_CUTOVER.md) | Canonical URLs, legacy redirects |
| [../STATUS.md](../STATUS.md) | Platform status and open items |
