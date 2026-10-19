// SPDX-License-Identifier: MPL-2.0
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const GUARD = resolve(ROOT, "tools/offline-guard.cjs");

export function runVerification({ run = spawnSync, log = console.log, env = process.env } = {}) {
  const childEnv = {
    ...env,
    NODE_OPTIONS: `--require ${JSON.stringify(GUARD)}`,
    npm_config_offline: "true",
    npm_config_update_notifier: "false",
    WRANGLER_SEND_METRICS: "false",
    GIT_NO_LAZY_FETCH: "1",
    GIT_TERMINAL_PROMPT: "0",
    CI: "true"
  };
  const snapshotArgs = ["tools/sync-xenia.mjs", "--check"];
  if (env.XENIA_FRAMEWORK_REPO) snapshotArgs.push("--source", env.XENIA_FRAMEWORK_REPO);
  const steps = [
    [process.execPath, snapshotArgs],
    ["npm", ["run", "check"]],
    ["npm", ["test"]],
    ["npm", ["run", "test:surface"]],
    ["npm", ["run", "build"]]
  ];
  for (const [command, args] of steps) {
    log(`\n[offline verify] ${command} ${args.join(" ")}`);
    const result = run(command, args, { cwd: ROOT, env: childEnv, stdio: "inherit", shell: false, timeout: 180_000 });
    if (result.error || result.signal || result.status !== 0) {
      log(`[offline verify] Stopped: ${result.error?.message ?? result.signal ?? `exit ${result.status}`}`);
      return Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    }
  }
  log("\nOffline verification passed. No install, upload, promotion, or publication step was run.");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runVerification();
}
