import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, extname, normalize, sep } from "node:path";
import { listenOnPort } from "./lib/listen-dev-server.mjs";
import { injectToolNav } from "./lib/tool-nav.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT) || 8765;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

/** @type {{ mount: string; dir: string }[]} */
const MOUNTS = [
  { mount: "/json", dir: "apps/json/public" },
  { mount: "/column-to-list", dir: "apps/column-to-list/public" },
  { mount: "/mermaid", dir: "apps/mermaid/public" },
  { mount: "/revealip", dir: "apps/revealip/public" },
  { mount: "/utc", dir: "apps/utc/public" },
  { mount: "/epoch", dir: "apps/epoch/public" },
  { mount: "/cron", dir: "apps/cron/public" },
  { mount: "/word-token-counter", dir: "apps/word-token-counter/public" },
  { mount: "/base64", dir: "apps/base64/public" },
  { mount: "/url-encode", dir: "apps/url-encode/public" },
  { mount: "/jwt", dir: "apps/jwt/public" },
  { mount: "/password", dir: "apps/password/public" },
];

function resolvePublic(appRel, urlPath) {
  const safePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const baseDir = join(rootDir, appRel);
  let filePath = join(baseDir, safePath);

  if (!filePath.startsWith(baseDir)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  return existsSync(filePath) && statSync(filePath).isFile() ? filePath : null;
}

/** @returns {{ filePath: string; toolId: string | null } | null} */
function resolveFile(urlPath) {
  if (urlPath === "/hub.config.json") {
    return { filePath: resolve(rootDir, "apps/hub/hub.config.json"), toolId: null };
  }

  for (const { mount, dir } of MOUNTS) {
    if (urlPath === mount || urlPath.startsWith(`${mount}/`)) {
      const rel = urlPath.slice(mount.length) || "/";
      const filePath = resolvePublic(dir, rel);
      return filePath ? { filePath, toolId: mount.slice(1) } : null;
    }
  }

  const filePath = resolvePublic("apps/hub/public", urlPath === "/" ? "/index.html" : urlPath);
  return filePath ? { filePath, toolId: null } : null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const resolved = resolveFile(url.pathname);

  if (!resolved) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const { filePath, toolId } = resolved;
  const ext = extname(filePath);

  // Mirror the build: tool entry pages are served with the hub tab bar baked in.
  if (toolId && filePath.endsWith(`${sep}index.html`)) {
    let html;
    try {
      html = injectToolNav(readFileSync(filePath, "utf8"), toolId);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(String(error.message));
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] });
    res.end(html);
    return;
  }

  const body = readFileSync(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(body);
});

await listenOnPort(server, port, "dev");

console.log("NeoNema tools dev server (no build step)");
console.log(`  http://localhost:${port}/`);
console.log(`  http://localhost:${port}/json/`);
console.log(`  http://localhost:${port}/revealip/`);
console.log(`  http://localhost:${port}/utc/`);
console.log(`  http://localhost:${port}/epoch/`);
console.log(`  http://localhost:${port}/cron/`);
console.log(`  http://localhost:${port}/mermaid/`);
console.log(`  http://localhost:${port}/word-token-counter/`);
console.log(`  http://localhost:${port}/base64/`);
console.log(`  http://localhost:${port}/url-encode/`);
console.log(`  http://localhost:${port}/jwt/`);
console.log(`  http://localhost:${port}/password/`);
console.log("  (legacy /#/<tool-id> opens that hub tab)");
