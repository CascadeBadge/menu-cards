// Shared access-code gate for this site.
//
// How it works:
// - Every request without a valid gate cookie is redirected to /enter
// - The visitor enters the shared code; POST /gate-check compares it against
//   the ACCESS_CODE secret (a Cloudflare Pages environment variable -- the
//   code value is NEVER stored in this repo)
// - On success, the visitor gets an HttpOnly cookie holding an HMAC-SHA256
//   signature keyed by the same secret (valid 1 year)
// - To change the code: update the ACCESS_CODE env var in Cloudflare
//   (Pages project -> Settings -> Environment variables). No deploy needed.
// - To remove the gate entirely: delete this file.

const COOKIE_NAME = "maniac_gate";
const GATE_PATH = "/enter";
const CHECK_PATH = "/gate-check";
const SIGNED_MESSAGE = "maniac-gate-v1";

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
      const sig = await hmacHex(secret, SIGNED_MESSAGE);
      const res = Response.redirect(new URL("/", request.url), 303);
      res.headers.set(
        "Set-Cookie",
        `${COOKIE_NAME}=${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
      );
      return res;
    }
    return Response.redirect(new URL(`${GATE_PATH}?e=1`, request.url), 303);
  }

  if (secret) {
    const cookie = getCookie(request, COOKIE_NAME);
    if (cookie) {
      const expected = await hmacHex(secret, SIGNED_MESSAGE);
      if (timingSafeEqual(cookie, expected)) {
        return context.next();
      }
    }
  }

  return Response.redirect(new URL(GATE_PATH, request.url), 303);
}
