import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { awsBaseArgs, getAppConfig, loadDeployConfig } from "./lib/deploy-config.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipInvalidate = args.includes("--no-invalidate");
const appName = args.find((arg) => !arg.startsWith("--"));

if (!appName) {
  console.error("Usage: npm run deploy -- <app-name> [--dry-run] [--no-invalidate]");
  console.error("Example: npm run deploy -- json");
  process.exit(1);
}

function run(command, commandArgs, { label }) {
  const display = [command, ...commandArgs].join(" ");
  console.log(`\n→ ${label}`);
  console.log(`  ${display}${dryRun ? "  (dry-run: skipped)" : ""}`);

  if (dryRun) return;

  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.error) {
    console.error(`deploy: failed to run "${command}" — is the AWS CLI installed?`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const { config } = loadDeployConfig();
const app = getAppConfig(config, appName);
const sourceDir = resolve(rootDir, app.source);

if (!existsSync(sourceDir)) {
  console.error(`deploy: source directory not found: ${sourceDir}`);
  process.exit(1);
}

const s3Target = `s3://${app.s3Bucket}/`;
const syncArgs = [
  "s3",
  "sync",
  sourceDir,
  s3Target,
  "--region",
  app.s3Region,
  "--only-show-errors",
  ...awsBaseArgs(app),
];

if (app.s3SyncDelete) {
  syncArgs.push("--delete");
}

run("aws", syncArgs, { label: `Sync ${app.source} → ${s3Target}` });

if (!skipInvalidate) {
  const paths = app.invalidatePaths?.length ? app.invalidatePaths : ["/*"];
  const invalidateArgs = [
    "cloudfront",
    "create-invalidation",
    "--distribution-id",
    app.cloudfrontDistributionId,
    "--paths",
    ...paths,
    ...awsBaseArgs(app),
  ];
  run("aws", invalidateArgs, { label: `Invalidate CloudFront ${app.cloudfrontDistributionId}` });
}

console.log(`\ndeploy: ${appName} complete${dryRun ? " (dry-run)" : ""}`);
