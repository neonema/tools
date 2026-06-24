import { copyFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const rootDir = resolve(process.cwd());
const brandDir = resolve(rootDir, "packages/brand");
const brandFiles = ["brand-tokens.css", "NeoNema.png"];

function discoverTargets(filterName) {
  const targets = [];
  const appsDir = resolve(rootDir, "apps");

  for (const entry of readdirSync(appsDir)) {
    if (filterName && entry !== filterName) continue;
    const publicDir = join(appsDir, entry, "public");
    try {
      if (statSync(publicDir).isDirectory()) {
        targets.push({ name: entry, publicDir });
      }
    } catch {
      // skip
    }
  }

  if (!filterName || filterName === "utility-template") {
    const templatePublic = resolve(rootDir, "packages/utility-template/public");
    try {
      if (statSync(templatePublic).isDirectory()) {
        targets.push({ name: "utility-template", publicDir: templatePublic });
      }
    } catch {
      // skip
    }
  }

  return targets;
}

const filterName = process.argv[2] || null;
const targets = discoverTargets(filterName);

if (filterName && targets.length === 0) {
  console.error(`sync-brand: no app found matching "${filterName}"`);
  process.exit(1);
}

if (targets.length === 0) {
  console.error("sync-brand: no targets found under apps/*/public");
  process.exit(1);
}

for (const { name, publicDir } of targets) {
  for (const file of brandFiles) {
    const source = join(brandDir, file);
    const dest = join(publicDir, file);
    copyFileSync(source, dest);
  }
  console.log(`  ✓ ${name}`);
}

console.log(`sync-brand: copied ${brandFiles.join(", ")} to ${targets.length} target(s)`);
