#!/usr/bin/env node
/**
 * `npm run build` entry.
 *
 * Cloudflare Pages sets CF_PAGES=1 and, with the Vite preset, publishes `dist`.
 * That path is a static site (no server). Every other build keeps the Nitro
 * output used by the sandbox preview.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(args, env = process.env) {
  const child = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", env });
  return child.status ?? 1;
}

if (process.env.CF_PAGES === "1") {
  process.exit(run(["scripts/build-pages.mjs"]));
}

const build = run(["scripts/with-app-env.mjs", "vite", "build"]);
if (build !== 0) process.exit(build);
process.exit(run(["scripts/migrate.mjs"]));
