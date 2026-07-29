import { spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const templateDir = resolve(rootDir, "packages/utility-template");
const args = process.argv.slice(2);

const TOOL_ID_RE = /^[a-z][a-z0-9-]*$/;

function usage() {
  console.log(`Usage: node scripts/scaffold-tool.mjs <tool-id> ["Tool Label"]
       npm run scaffold -- <tool-id> ["Tool Label"]

Copies packages/utility-template/ to apps/<tool-id>/ and runs sync-brand.
Does not modify hub.config.json or scripts/build.mjs.

After scaffolding, follow docs/ADD_A_TOOL.md to register the tool.`);
}

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const toolId = args.find((arg) => !arg.startsWith("-"));
const toolLabel = args.filter((arg) => !arg.startsWith("-"))[1] ?? null;

if (!toolId) {
  console.error("scaffold-tool: missing <tool-id>");
  usage();
  process.exit(1);
}

if (!TOOL_ID_RE.test(toolId)) {
  console.error(
    `scaffold-tool: invalid tool id "${toolId}" (use lowercase letters, digits, hyphens; start with a letter)`,
  );
  process.exit(1);
}

if (!existsSync(templateDir)) {
  console.error("scaffold-tool: packages/utility-template/ not found");
  process.exit(1);
}

const destDir = resolve(rootDir, "apps", toolId);
if (existsSync(destDir)) {
  console.error(`scaffold-tool: apps/${toolId}/ already exists`);
  process.exit(1);
}

cpSync(templateDir, destDir, { recursive: true });
console.log(`  ✓ copied utility-template → apps/${toolId}/`);

const syncResult = spawnSync("node", ["./scripts/sync-brand.mjs", toolId], {
  cwd: rootDir,
  stdio: "inherit",
});

if (syncResult.status !== 0) {
  process.exit(syncResult.status ?? 1);
}

console.log(`\nscaffold-tool: created apps/${toolId}/`);
if (toolLabel) {
  console.log(`  label hint: "${toolLabel}" — update index.html title and hub.config.json when registering`);
}
console.log("Next: implement the tool and register in hub.config.json + scripts/build.mjs");
console.log("See docs/ADD_A_TOOL.md");
