import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { awsBaseArgs, getAppConfig, loadDeployConfig } from "./lib/deploy-config.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const appName = args.find((arg) => !arg.startsWith("--"));

if (!appName) {
  console.error("Usage: npm run deploy:edge -- <app-name> [--dry-run]");
  console.error("Example: npm run deploy:edge -- revealip");
  process.exit(1);
}

function runJson(command, commandArgs) {
  const display = [command, ...commandArgs].join(" ");
  console.log(`  ${display}`);

  if (dryRun) return null;

  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.error) {
    console.error(`deploy-edge: failed to run "${command}" — is the AWS CLI installed?`);
    process.exit(1);
  }
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout || "{}");
}

const { config } = loadDeployConfig();
const app = getAppConfig(config, appName);

if (!app.edge?.cloudfrontFunctionName || !app.edge?.functionSource) {
  console.error(`deploy-edge: apps.${appName}.edge is not configured in deploy.config.json`);
  process.exit(1);
}

const functionPath = resolve(rootDir, app.edge.functionSource);
if (!existsSync(functionPath)) {
  console.error(`deploy-edge: function source not found: ${functionPath}`);
  process.exit(1);
}

const functionName = app.edge.cloudfrontFunctionName;
const baseArgs = awsBaseArgs(app);

console.log(`\n→ Publish CloudFront Function "${functionName}" from ${app.edge.functionSource}`);

const described = runJson("aws", [
  "cloudfront",
  "describe-function",
  "--name",
  functionName,
  ...baseArgs,
  "--output",
  "json",
]);

if (!described) {
  console.log("\ndeploy-edge: dry-run complete");
  process.exit(0);
}

const runtime = app.edge.runtime || described.FunctionSummary?.FunctionConfig?.Runtime || "cloudfront-js-2.0";
const comment = described.FunctionSummary?.FunctionConfig?.Comment || functionName;

const updated = runJson("aws", [
  "cloudfront",
  "update-function",
  "--name",
  functionName,
  "--if-match",
  described.ETag,
  "--function-config",
  `Comment=${comment},Runtime=${runtime}`,
  "--function-code",
  `fileb://${functionPath}`,
  ...baseArgs,
  "--output",
  "json",
]);

runJson("aws", [
  "cloudfront",
  "publish-function",
  "--name",
  functionName,
  "--if-match",
  updated.ETag,
  ...baseArgs,
  "--output",
  "json",
]);

console.log(`\ndeploy-edge: ${functionName} published${dryRun ? " (dry-run)" : ""}`);
