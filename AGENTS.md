# AGENTS: NeoNema Utility Website Standards

This file defines mandatory instructions for AI/LLM agents working in this repository.

## Core Product Direction
- Build **utility websites** for NeoNema.
- Default scope is **one-page websites**.
- Prefer static architecture and browser-first implementation.

## Cost and Overhead Rules
- Avoid adding APIs, backend services, databases, or third-party dependencies unless explicitly requested.
- Avoid features that create rate-limiting risk, recurring usage fees, or operational overhead.
- Prefer client-side processing in `public/app.js`.

## Theme and Palette Rules
- Always keep the NeoNema design system and color palette aligned with `LLM_PRODUCT_RULES.md`.
- Do not introduce a conflicting visual language or random color sets.
- Reuse the design tokens in `public/styles.css`.

## Delivery Rules for Agents
- Keep pages lightweight, fast, and mobile-friendly.
- Keep copy clear and utility-first.
- If changing structure, preserve one-page flow unless user explicitly asks for multi-page expansion.
