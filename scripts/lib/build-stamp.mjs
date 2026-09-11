import { execSync } from "node:child_process";

/**
 * Build stamp: the deployed commit, written into every page footer and into
 * /version.json so anyone can confirm which commit tools.neonema.com serves.
 */

export const REPO_URL = "https://github.com/yuhahaha/neonema-tools";

const STAMP_CSS = `.build-stamp { color: var(--muted); font-size: 0.8125rem; }
.build-stamp a { color: var(--muted); text-decoration: none; }
.build-stamp a:hover { color: var(--foreground); }`;

/** @returns {string} full commit SHA, or "dev" when not in git and not in CI */
export function resolveBuildCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}

function renderStamp(commit) {
  if (commit === "dev") return '<span class="build-stamp">Build dev</span>';
  const short = commit.slice(0, 7);
  return `<span class="build-stamp">Build <a href="${REPO_URL}/commit/${commit}" rel="noopener">${short}</a></span>`;
}

/**
 * @param {string} html page HTML that contains a `<footer class="footer">` block
 * @param {string} commit
 * @returns {string}
 */
export function injectBuildStamp(html, commit) {
  if (html.includes('class="build-stamp"')) return html;
  const footerClose = html.lastIndexOf("</footer>");
  if (footerClose === -1) {
    throw new Error("build-stamp: page has no <footer> to stamp");
  }
  if (!html.includes("</head>")) {
    throw new Error("build-stamp: page has no </head>");
  }
  const stamped = `${html.slice(0, footerClose)}  ${renderStamp(commit)}\n    ${html.slice(footerClose)}`;
  return stamped.replace("</head>", `  <style>\n${STAMP_CSS}\n    </style>\n  </head>`);
}
