import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Injects the cross-tool tab bar into a standalone tool page.
 *
 * Tool pages are indexable entry points served at `/<tool-id>/`, so the nav has
 * to be in the HTML the crawler receives — not painted on by JS. Both the build
 * (dist/) and the dev server run this, so the two stay in step.
 */

const rootDir = resolve(import.meta.dirname, "..", "..");
const hubConfigPath = resolve(rootDir, "apps/hub/hub.config.json");
const navCssPath = resolve(rootDir, "packages/brand/tool-nav.css");

/** Matches `.header-inner` through the end of the `.brand` block it opens with. */
const BRAND_BLOCK = /<div class="header-inner">\s*<div class="brand">[\s\S]*?<\/div>/;

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);

/** @returns {{ id: string; label: string; path: string }[]} */
export function readHubTools() {
  const config = JSON.parse(readFileSync(hubConfigPath, "utf8"));
  const tools = Array.isArray(config.tools) ? config.tools : [];
  if (!tools.length) {
    throw new Error("apps/hub/hub.config.json lists no tools");
  }
  return tools;
}

function renderToolNav(tools, activeToolId) {
  const links = tools.map((tool) => {
    const href = `/${encodeURIComponent(tool.id)}/`;
    const current = tool.id === activeToolId ? ' aria-current="page"' : "";
    return `            <a class="tool-nav-tab" href="${href}"${current}>${escapeHtml(tool.label)}</a>`;
  });

  return [
    '        <nav class="tool-nav" aria-label="NeoNema tools">',
    '          <div class="tool-nav-tabs">',
    ...links,
    "          </div>",
    "        </nav>",
  ].join("\n");
}

/**
 * @param {string} html raw tool page HTML
 * @param {string} activeToolId tool the page belongs to; gets aria-current
 * @param {{ id: string; label: string }[]} [tools]
 * @returns {string}
 */
export function injectToolNav(html, activeToolId, tools = readHubTools()) {
  // Idempotent: re-running over already-injected HTML is a no-op, so the dev
  // server and build can both be pointed at the same file safely.
  if (html.includes('class="tool-nav"')) return html;

  if (!BRAND_BLOCK.test(html)) {
    throw new Error(
      `tool-nav: no \`.header-inner > .brand\` block found in the ${activeToolId} page — ` +
        "tool pages must keep the shared brand header markup",
    );
  }
  if (!html.includes("</head>")) {
    throw new Error(`tool-nav: no </head> in the ${activeToolId} page`);
  }

  const css = readFileSync(navCssPath, "utf8").trim();

  return html
    .replace(BRAND_BLOCK, (block) => `${block}\n${renderToolNav(tools, activeToolId)}`)
    .replace("</head>", `  <style>\n${css}\n    </style>\n  </head>`);
}
