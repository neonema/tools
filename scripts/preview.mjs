import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, extname, normalize } from "node:path";
import { listenOnPort } from "./lib/listen-dev-server.mjs";

const rootDir = resolve(import.meta.dirname, "..", "dist");
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
};

if (!existsSync(rootDir)) {
  console.error("preview: dist/ not found — run npm run build first");
  process.exit(1);
}

function resolveFile(urlPath) {
  const safePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(rootDir, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(rootDir)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  return existsSync(filePath) && statSync(filePath).isFile() ? filePath : null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const filePath = resolveFile(url.pathname);

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const body = readFileSync(filePath);
  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(body);
});

await listenOnPort(server, port, "preview");

console.log("NeoNema tools preview (built dist/)");
console.log(`  http://localhost:${port}/`);
console.log(`  http://localhost:${port}/#/json`);
console.log(`  http://localhost:${port}/#/revealip`);
console.log(`  http://localhost:${port}/#/utc`);
