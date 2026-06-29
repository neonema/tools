import { execSync } from "node:child_process";

/**
 * SIGTERM processes listening on `port` (except the current process).
 * Returns PIDs that were signaled.
 */
export function freePort(port) {
  const ownPid = process.pid;
  const killed = [];

  let output;
  try {
    output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null`, { encoding: "utf8" }).trim();
  } catch {
    return killed;
  }

  if (!output) return killed;

  for (const pidStr of new Set(output.split("\n").filter(Boolean))) {
    const pid = Number(pidStr);
    if (pid === ownPid) continue;
    try {
      process.kill(pid, "SIGTERM");
      killed.push(pid);
    } catch {
      // process already exited
    }
  }

  return killed;
}
