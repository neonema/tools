# Mermaid Preview

Paste Markdown (or raw Mermaid) and preview diagrams in the browser. Uses a vendored copy of Mermaid 10.9.3 — nothing is uploaded.

## Local preview

From the monorepo root:

```bash
npm run dev
```

Open [http://localhost:8765/mermaid/](http://localhost:8765/mermaid/).

## Deploy

Ships with the platform build (`dist/mermaid/`). Public entry:
`https://tools.neonema.com/mermaid/`. See [docs/DEPLOY.md](../../docs/DEPLOY.md).
