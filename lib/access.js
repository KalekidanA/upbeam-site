// Checks that a request was signed in through Cloudflare Access (Zero Trust) by an allowed admin.
// Verifies the Access JWT itself, so the admin API stays locked even on upbeam.pages.dev and
// preview URLs, where Access may not sit in front of the site.
//
// Needs three Pages environment variables:
//   ACCESS_TEAM_DOMAIN  e.g. "upbeam.cloudflareaccess.com"
//   ACCESS_AUD          the Access application's "Application Audience (AUD) Tag"
//   ADMIN_EMAILS        comma-separated emails allowed in, e.g. "me@example.com"
// If any is missing, everyone is refused.

let certCache = { domain: '', keys: null, at: 0 };

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodePart(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function signingKeys(domain) {
  if (certCache.domain === domain && certCache.keys && Date.now() - certCache.at < 3600_000) {
    return certCache.keys;
  }
  const res = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const { keys } = await res.json();
  certCache = { domain, keys, at: Date.now() };
  return keys;
}

function tokenFrom(request) {
  const header = request.headers.get('cf-access-jwt-assertion');
  if (header) return header;
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1] : null;
}

/** Returns the signed-in admin's email, or null if the request isn't allowed. */
export async function adminEmail(request, env) {
  const domain = (env.ACCESS_TEAM_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const aud = (env.ACCESS_AUD || '').trim();
  const allowed = (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!domain || !aud || allowed.length === 0) return null;

  const token = tokenFrom(request);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    if (header.alg !== 'RS256') return null;

    const jwk = (await signingKeys(domain)).find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
    if (payload.iss !== `https://${domain}`) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;

    const email = (payload.email || '').toLowerCase();
    return allowed.includes(email) ? email : null;
  } catch (err) {
    console.error('access check failed', err);
    return null;
  }
}
