# Access gate

This site sits behind a shared access-code gate implemented in
`_middleware.js` (a Cloudflare Pages Function — it runs on every request).

## How it works

- Requests without a valid `maniac_gate` cookie are redirected to `/enter`.
- The visitor enters the shared code; `POST /gate-check` compares it against
  the `ACCESS_CODE` secret using a timing-safe comparison.
- On success, the visitor receives an `HttpOnly; Secure; SameSite=Lax` cookie
  containing an HMAC-SHA256 signature keyed by the same secret (valid 1 year).
- Fail-closed: if `ACCESS_CODE` is not set, everyone lands on `/enter`.

## Where the code value lives (NOT in this repo)

- Cloudflare: Pages project -> Settings -> Environment variables -> `ACCESS_CODE`
- GitHub: repo Settings -> Secrets and variables -> Actions -> `ACCESS_CODE`
  (backup/reference)

## Changing / removing

- To CHANGE the code: update the `ACCESS_CODE` env var in Cloudflare (and the
  GitHub secret). No code deploy needed.
- To REMOVE the gate: delete `_middleware.js`.

## Cloudflare Pages deployment

- Build command: `npm run build:pages` (builds with `vite.pages.config.ts`, then copies static output to `dist/`)
- Build output directory: `dist`
- The `functions/` directory at the repo root is deployed as Pages Functions (see the access gate docs above).
- Sign-in is disabled for the static deployment (`VITE_AUTH_ENABLED=false` is forced during the pages build).

- The project sets the `npm_config_legacy_peer_deps=true` environment variable
  (Cloudflare Pages project settings). npm reads `npm_config_*` env vars as
  config: this makes the dependency install skip strict peer-dependency
  resolution, working around an npm 10 crash (`edgesOut` in arborist) triggered
  by the vitest 4.x peer graph pulled in via vite 8's `@vitejs/devtools`.
  Do NOT remove this variable unless the underlying npm bug is fixed.
