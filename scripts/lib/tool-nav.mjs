import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Injects the grouped cross-tool nav into an entry page.
 *
 * Entry pages are indexable — the hub at `/` and every tool at `/<tool-id>/` —
 * so the nav has to be in the HTML the crawler receives, not painted on by JS.
 * Both the build (dist/) and the dev server run this, so the two stay in step.
 *
 * Markup, per category in hub.config.json:
 *
 *   <details class="tool-nav-group" data-category="time">
 *     <summary class="tool-nav-tab">Time <span class="tool-nav-tab-current">Epoch</span></summary>
 *     <div class="tool-nav-menu"> <a class="tool-nav-link" data-tool-id="utc" href="/utc/">UTC</a> … </div>
 *   </details>
 */

const rootDir = resolve(import.meta.dirname, "..", "..");
const hubConfigPath = resolve(rootDir, "apps/hub/hub.config.json");
const navCssPath = resolve(rootDir, "packages/brand/tool-nav.css");
const navJsPath = resolve(rootDir, "packages/brand/tool-nav.js");

/** Matches `.header-inner` through the end of the `.brand` block it opens with. */
const BRAND_BLOCK =
  /<div class="header-inner(?: header-inner--with-nav)?">\s*<div class="brand">[\s\S]*?<\/div>/;

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);

/**
 * @typedef {{ id: string; label: string }} HubCategory
 * @typedef {{ id: string; label: string; category: string; path: string }} HubTool
 * @typedef {{ defaultTool: string; categories: HubCategory[]; tools: HubTool[] }} HubConfig
 */

/** @returns {HubConfig} */
export function readHubConfig() {
  const config = JSON.parse(readFileSync(hubConfigPath, "utf8"));
  const categories = Array.isArray(config.categories) ? config.categories : [];
  const tools = Array.isArray(config.tools) ? config.tools : [];

  if (!tools.length) throw new Error("apps/hub/hub.config.json lists no tools");
  if (!categories.length) throw new Error("apps/hub/hub.config.json lists no categories");

  const categoryIds = new Set();
  for (const category of categories) {
    if (!category?.id || !category?.label) {
      throw new Error("hub.config.json: every category needs an id and a label");
    }
    if (categoryIds.has(category.id)) {
      throw new Error(`hub.config.json: duplicate category id "${category.id}"`);
    }
    categoryIds.add(category.id);
  }

  for (const tool of tools) {
    if (!tool?.id || !tool?.label) {
      throw new Error("hub.config.json: every tool needs an id and a label");
    }
    if (!categoryIds.has(tool.category)) {
      throw new Error(
        `hub.config.json: tool "${tool.id}" has category "${tool.category}", which is not in "categories"`,
      );
    }
  }

  return config;
}

/** @returns {HubTool[]} */
export function readHubTools() {
  return readHubConfig().tools;
}

/**
 * @param {HubConfig} config
 * @param {string | null} activeToolId
 */
function renderToolNav(config, activeToolId) {
  const groups = [];

  for (const category of config.categories) {
    const tools = config.tools.filter((tool) => tool.category === category.id);
    if (!tools.length) continue;

    const active = tools.find((tool) => tool.id === activeToolId) ?? null;
    const links = tools.map((tool) => {
      const href = `/${encodeURIComponent(tool.id)}/`;
      const current = tool.id === activeToolId ? ' aria-current="page"' : "";
      return (
        `                <a class="tool-nav-link" data-tool-id="${escapeHtml(tool.id)}" href="${href}"${current}>` +
        `${escapeHtml(tool.label)}</a>`
      );
    });

    groups.push(
      `            <details class="tool-nav-group${active ? " is-active" : ""}" data-category="${escapeHtml(category.id)}">`,
      `              <summary class="tool-nav-tab"><span class="tool-nav-tab-label">${escapeHtml(category.label)}</span>` +
        `<span class="tool-nav-tab-current">${active ? escapeHtml(active.label) : ""}</span></summary>`,
      '              <div class="tool-nav-menu">',
      ...links,
      "              </div>",
      "            </details>",
    );
  }

  return [
    '        <nav class="tool-nav" aria-label="NeoNema tools">',
    '          <div class="tool-nav-groups">',
    ...groups,
    "          </div>",
    "        </nav>",
  ].join("\n");
}

/**
 * @param {string} html raw entry page HTML
 * @param {string | null} activeToolId tool the page belongs to (gets aria-current); null for the hub
 * @param {HubConfig} [config]
 * @returns {string}
 */
export function injectToolNav(html, activeToolId, config = readHubConfig()) {
  // Idempotent: re-running over already-injected HTML is a no-op, so the dev
  // server and build can both be pointed at the same file safely.
  if (html.includes('class="tool-nav"')) return html;

  const pageName = activeToolId ?? "hub";
  if (!BRAND_BLOCK.test(html)) {
    throw new Error(
      `tool-nav: no \`.header-inner > .brand\` block found in the ${pageName} page — ` +
        "entry pages must keep the shared brand header markup",
    );
  }
  if (!html.includes('<header class="header">')) {
    throw new Error(`tool-nav: no \`<header class="header">\` in the ${pageName} page`);
  }
  if (!html.includes("</head>") || !html.includes("</body>")) {
    throw new Error(`tool-nav: no </head> or </body> in the ${pageName} page`);
  }

  const css = readFileSync(navCssPath, "utf8").trim();
  const js = readFileSync(navJsPath, "utf8").trim();

  return html
    .replace('<header class="header">', '<header class="header header--with-nav">')
    .replace('<div class="header-inner">', '<div class="header-inner header-inner--with-nav">')
    .replace(BRAND_BLOCK, (block) => `${block}\n${renderToolNav(config, activeToolId)}`)
    .replace("</head>", `  <style>\n${css}\n    </style>\n  </head>`)
    .replace("</body>", `  <script>\n${js}\n    </script>\n  </body>`);
}
