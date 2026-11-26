// Admin only: GET /api/admin/waitlist        → JSON list of sign-ups, newest first
//             GET /api/admin/waitlist?csv=1  → the same list as a CSV download
// Locked by Cloudflare Access; see lib/access.js and README › Admin page.
import { adminEmail } from '../../../lib/access.js';

const NO_STORE = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

// Stops a spreadsheet from treating a cell as a formula.
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function onRequestGet({ request, env }) {
  const admin = await adminEmail(request, env);
  if (!admin) {
    return new Response(JSON.stringify({ ok: false, message: 'Not signed in as an admin.' }), {
      status: 403, headers: { 'content-type': 'application/json', ...NO_STORE },
    });
  }
  if (!env.WAITLIST_DB) {
    return new Response(JSON.stringify({ ok: false, message: 'The waitlist database is not connected.' }), {
      status: 503, headers: { 'content-type': 'application/json', ...NO_STORE },
    });
  }

  let rows = [];
  try {
    const result = await env.WAITLIST_DB.prepare(
      'SELECT email, joined_at, source, future_apps FROM waitlist ORDER BY joined_at DESC'
    ).all();
    rows = result.results || [];
  } catch (err) {
    // No sign-ups yet: the table is created on the first one.
    if (!/no such table/i.test(String(err))) {
      console.error('admin waitlist read failed', err);
      return new Response(JSON.stringify({ ok: false, message: 'Could not read the waitlist.' }), {
        status: 500, headers: { 'content-type': 'application/json', ...NO_STORE },
      });
    }
  }

  if (new URL(request.url).searchParams.has('csv')) {
    const lines = [['email', 'joined_at', 'source', 'agreed_to_app_emails'].join(',')];
    for (const r of rows) {
      lines.push([r.email, r.joined_at, r.source, r.future_apps ? 'yes' : 'launch email only'].map(csvCell).join(','));
    }
    const day = new Date().toISOString().slice(0, 10);
    return new Response(lines.join('\r\n') + '\r\n', {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="upbeam-waitlist-${day}.csv"`,
        ...NO_STORE,
      },
    });
  }

  return new Response(JSON.stringify({ ok: true, admin, rows }), {
    headers: { 'content-type': 'application/json', ...NO_STORE },
  });
}

export function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'GET', ...NO_STORE } });
}
