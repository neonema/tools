# NeoNema Tools

Browser-only utilities. Live at **[tools.neonema.com](https://tools.neonema.com)**.

This repository is the client-side source so you can verify that every tool runs in your browser. Each tool is plain HTML, CSS, and JS under `apps/<tool>/public/`. There is no server application. RevealIP’s `/api/ip` is a small CloudFront Function in `apps/revealip/cloudfront/`; it returns the caller’s IP and stores nothing.

Every deployed page footer names the commit it was built from. [`/version.json`](https://tools.neonema.com/version.json) reports the same commit.

The NeoNema name and logo are trademarks and are not licensed with the code.

## License

Source-available, all rights reserved. You may read, download, and run this code to verify what it does. Any other use requires written permission or a commercial license. See [LICENSE](LICENSE).
