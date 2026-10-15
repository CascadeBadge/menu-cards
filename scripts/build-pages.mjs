#!/usr/bin/env node
/**
 * Static export for Cloudflare Pages and Vercel.
 *
 * Nitro prerenders index.html, then tries to bundle a server whose entry is
 * that HTML file and Vite rejects it. The public files are already complete,
 * so a failed server step is ignored when index.html and its assets exist.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, ".output/public");
const indexPath = join(source, "index.html");

const build = spawnSync(
  process.execPath,
  ["scripts/with-app-env.mjs", "vite", "build", "--config", "vite.pages.config.ts"],
  { cwd: root, stdio: "inherit" },
);

const html = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
const asset = html.match(/src="(\/assets\/[^"]+\.js)"/);
if (!html.includes("Menu Cards") || !asset) {
  console.error("[pages] static index.html was not produced");
  process.exit(build.status || 1);
}
if (!existsSync(join(source, asset[1].slice(1)))) {
  console.error(`[pages] missing ${asset[1]}`);
  process.exit(1);
}
if (build.status !== 0) {
  console.log("[pages] static files are ready; the unused server bundle was skipped");
}

const dest = join(root, "dist");
rmSync(dest, { recursive: true, force: true });
cpSync(source, dest, { recursive: true });
console.log(`[pages] wrote dist (${readdirSync(dest).join(", ")})`);
