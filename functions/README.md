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
