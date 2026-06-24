# LLM Product Rules: NeoNema Utility Sites

Use these rules for all generated features, edits, and new templates in this repository.

## 1) Website Shape
- Build as a **single-page utility site** by default.
- Keep the user flow direct: headline, tool, output, and optional trust/legal links.
- Do not add unnecessary navigation complexity.

## 2) Low-Overhead Requirement
- No backend/API integration by default.
- No expensive third-party services by default.
- Keep processing local to the browser where possible.
- If external calls are unavoidable, clearly mark them as optional and explain why.

## 3) Mandatory NeoNema Palette
Use these as base design tokens:

- `--background: #0b0f0d`
- `--foreground: #ffffff`
- `--card: #18211d`
- `--primary: #39d98a`
- `--muted: #9da7a2`
- `--border: #25322d`

## 4) Theme Consistency
- Use dark, high-contrast NeoNema visual style.
- Keep typography modern and clean (Outfit/system sans stack).
- Primary accent usage should center around `--primary` for key actions and highlights.

## 5) Brand Language
- Parent brand is **NeoNema**.
- Products should be presented as NeoNema utility products.
