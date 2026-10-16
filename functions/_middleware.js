// Shared access-code gate for this site.
//
// How it works:
// - Every request without a valid gate cookie is redirected to /enter
// - The visitor enters the shared code; POST /gate-check compares it against
//   the ACCESS_CODE secret (a Cloudflare Pages environment variable -- the
//   code value is NEVER stored in this repo)
// - On success, the visitor gets an HttpOnly cookie holding a hash derived
//   from the secret (valid 1 year). The hash can't be reversed to reveal
//   the code, and can't be forged without knowing the code.
// - To change the code: update the ACCESS_CODE env var in Cloudflare
//   (Pages project -> Settings -> Environment variables), then redeploy.
// - To remove the gate entirely: delete this file.

const COOKIE_NAME = "maniac_gate";
const GATE_PATH = "/enter";
const CHECK_PATH = "/gate-check";

// cyrb53: fast, deterministic, non-reversible 53-bit hash.
// Synchronous (no WebCrypto) for maximum runtime compatibility.
function hashSecret(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const s = "maniac-gate-v1|" + str;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") +
         (h1 >>> 0).toString(16).padStart(8, "0");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

function redirectWithCookie(url, cookieValue) {
  const headers = { "Location": url.toString() };
  if (cookieValue) {
    headers["Set-Cookie"] =
      `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
  }
  return new Response(null, { status: 303, headers });
}

function gatePage(failed) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>enter code</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    background: #07080a; color: #dbdee1;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    display: flex; align-items: center; justify-content: center;
  }
  form { text-align: center; }
  .prompt { color: #22d3ee; margin-bottom: 12px; }
  input {
    background: #111318; border: 1px solid #22d3ee; color: #fff;
    padding: 10px 14px; font-size: 16px; border-radius: 6px;
    font-family: inherit; text-align: center; outline: none;
  }
  button {
    display: block; margin: 12px auto 0; padding: 8px 24px;
    background: #22d3ee; color: #07080a; border: 0; border-radius: 6px;
    font-family: inherit; font-size: 14px; cursor: pointer;
  }
  .err { color: #ec4899; margin-top: 10px; font-size: 13px; }
</style>
</head>
<body>
  <form method="POST" action="${CHECK_PATH}">
    <div class="prompt">&gt; enter access code</div>
    <input type="password" name="code" autocomplete="off" autofocus />
    <button type="submit">unlock</button>
    ${failed ? '<div class="err">wrong code, try again</div>' : ""}
  </form>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = env.ACCESS_CODE || "";

  if (url.pathname === GATE_PATH) {
    return new Response(gatePage(url.searchParams.get("e") === "1"), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  }

  if (url.pathname === CHECK_PATH && request.method === "POST") {
    const form = await request.formData();
    const code = (form.get("code") || "").toString().trim();
    if (secret && timingSafeEqual(code, secret)) {
      return redirectWithCookie(new URL("/", request.url), hashSecret(secret));
    }
    return redirectWithCookie(new URL(`${GATE_PATH}?e=1`, request.url), null);
  }

  if (secret) {
    const cookie = getCookie(request, COOKIE_NAME);
    if (cookie && timingSafeEqual(cookie, hashSecret(secret))) {
      return context.next();
    }
  }

  return redirectWithCookie(new URL(GATE_PATH, request.url), null);
}
