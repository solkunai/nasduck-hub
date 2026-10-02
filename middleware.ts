import { next } from '@vercel/functions'

// Server-side password gate for the pre-launch mint page only — runs on
// Vercel before the request ever reaches the static site, so (unlike a
// client-side check) the password never ships in the JS bundle and can't be
// read or bypassed via dev tools.
//
// MINT_GATE_PASSWORD must be set as a plain (non-VITE_-prefixed) env var in
// the Vercel project dashboard — never commit it, and never prefix it with
// VITE_, which would bundle it straight into the public client JS.
export const config = {
  matcher: ['/mint', '/mint/:path*'],
}

const COOKIE_NAME = 'nasducks_mint_access'

// SHA-256 of the password, not the password itself — so inspecting the
// cookie in dev tools (even your own, after a legitimate login) doesn't
// hand back the plaintext password.
async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function passwordForm(error?: string): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NasDucks Mint — Access Required</title>
<style>
  body { background:#0B2350; color:#F0E4CC; font-family:ui-monospace,monospace; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  form { background:#02060E; border:3px solid #1F6B3A; padding:28px; width:min(90vw,340px); text-align:center; }
  h1 { font-size:18px; color:#F7E7C1; margin:0 0 16px; }
  input { width:100%; box-sizing:border-box; padding:10px; margin-bottom:12px; background:#0B1220; border:1px solid #3A4A66; color:#F0E4CC; font-family:inherit; }
  button { width:100%; padding:10px; background:#F5911E; color:#02060E; border:none; font-weight:bold; cursor:pointer; font-family:inherit; }
  .error { color:#FF5A4E; font-size:13px; margin-bottom:12px; }
</style>
</head>
<body>
  <form method="POST">
    <h1>🦆 NasDucks Mint — Private Preview</h1>
    ${error ? `<div class="error">${error}</div>` : ''}
    <input type="password" name="password" placeholder="Password" autofocus required />
    <button type="submit">Enter</button>
  </form>
</body>
</html>`
  return new Response(html, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export default async function middleware(request: Request) {
  const correctPassword = process.env.MINT_GATE_PASSWORD
  // Fails CLOSED if the env var isn't set — the entire point of this gate is
  // keeping an unfinished page private, so a misconfiguration should block
  // everyone (including, briefly, the owner) rather than accidentally
  // leave the page wide open to the public.
  if (!correctPassword) {
    console.error('[mint-gate] MINT_GATE_PASSWORD is not set — denying all access until it is configured in Vercel.')
    return new Response('Mint page is not yet configured for access.', { status: 503 })
  }

  const expectedCookie = await hash(correctPassword)
  const cookie = request.headers.get('cookie') ?? ''
  const hasAccess = cookie.split(';').some((c) => c.trim() === `${COOKIE_NAME}=${expectedCookie}`)
  if (hasAccess) return next()

  if (request.method === 'POST') {
    const form = await request.formData()
    const submitted = form.get('password')
    if (submitted === correctPassword) {
      const res = Response.redirect(request.url, 303)
      res.headers.append(
        'Set-Cookie',
        `${COOKIE_NAME}=${expectedCookie}; Path=/mint; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`,
      )
      return res
    }
    return passwordForm('Wrong password.')
  }

  return passwordForm()
}
