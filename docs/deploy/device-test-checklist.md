# Device Test Checklist

Use this quick pass before production release.

## Target viewports
- 320 x 568 (small phone)
- 375 x 667 (standard phone)
- 390 x 844 (modern phone)
- 768 x 1024 (tablet portrait)
- 1366 x 768 (desktop)

## What to verify on each viewport
- Home page loads without horizontal scrolling.
- Primary IP text stays inside the viewport.
- IPv6 text wraps cleanly and remains readable.
- Copy button is visible and clickable.
- Footer links stay readable and do not overlap.
- Ad block does not overflow container width.

## Functional checks
- `/api/ip` returns a valid response.
- Copy button copies current primary IP.
- Privacy and Terms pages open from footer links.

## Network checks
- Test once on normal network.
- Test once with VPN enabled.
- Test once on mobile data (if available).
