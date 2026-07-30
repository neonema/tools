import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "../..");

export function loadDeployConfig() {
  const configPath = process.env.DEPLOY_CONFIG || resolve(rootDir, "deploy.config.json");

  if (!existsSync(configPath)) {
    console.error(`deploy: missing ${configPath}`);
    console.error("Copy deploy.config.prod.json to deploy.config.json and add \"awsProfile\": \"neonema-tools\".");
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error(`deploy: could not parse ${configPath} — ${error.message}`);
    process.exit(1);
  }

  if (!config.apps || typeof config.apps !== "object") {
    console.error("deploy: deploy.config.json must include an \"apps\" object");
    process.exit(1);
  }

  return { configPath, config };
}

export function getAppConfig(config, appName) {
  const app = config.apps[appName];
  if (!app) {
    const known = Object.keys(config.apps).join(", ");
    console.error(`deploy: unknown app "${appName}". Known apps: ${known}`);
    process.exit(1);
  }

  const required = ["source", "s3Bucket", "s3Region", "cloudfrontDistributionId"];
  for (const key of required) {
    if (!app[key] || String(app[key]).includes("YOUR_")) {
      console.error(`deploy: apps.${appName}.${key} is missing or still a placeholder in deploy.config.json`);
      process.exit(1);
    }
  }

  return app;
}

export function awsBaseArgs(app) {
  const args = [];
  if (app.awsProfile) {
    args.push("--profile", app.awsProfile);
  }
  return args;
}
