import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";

/**
 * Static export for Cloudflare Pages and Vercel.
 * The dev server keeps using vite.config.ts. This build prerenders one
 * index.html and ships the client bundle with no server function.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    appEnvPlugin(),
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index.html",
          crawlLinks: false,
        },
      },
    }),
    nitro({ preset: "static" }),
    viteReact(),
  ],
});
