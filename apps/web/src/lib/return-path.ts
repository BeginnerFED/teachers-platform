/**
 * Where to send somebody once they have signed in, from a value anybody could have put in
 * the address bar — the `next` the proxy adds to /login.
 *
 * Only a path on this site comes back. Anything that would leave it — another host, a
 * protocol-relative "//host", a backslash a browser reads as a slash, a scheme — is
 * dropped rather than repaired, and the caller falls back to the home page: a sign-in
 * form that forwards to whatever address it is handed is a gift to a phishing page.
 */
export function returnPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/')) return null

  // Resolved against a placeholder origin, so the browser's own parsing rules decide what
  // the value means: "/\evil.com" and "/<tab>/evil.com" both turn out to name a host.
  const base = 'http://return-path.invalid'
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return null
  }
  if (url.origin !== base) return null

  const path = `${url.pathname}${url.search}${url.hash}`

  // Dot segments can still collapse into "//host" once the path is normalised.
  return path.startsWith('//') ? null : path
}
