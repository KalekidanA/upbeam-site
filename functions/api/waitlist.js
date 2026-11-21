// Upbeam waitlist: POST /api/waitlist
// Stores sign-ups in a Cloudflare D1 database bound to this Pages project as WAITLIST_DB.
// No cookies, no IP addresses, no third parties. Only the fields below are stored.

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function reply(request, ok, message, status) {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  if (wantsJson) {
    return new Response(JSON.stringify({ ok, message }), {
      status: status || (ok ? 200 : 400),
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  // Without JavaScript, send people to a plain confirmation page.
  const url = new URL(ok ? '/joined.html' : '/joined.html?error=1', request.url);
  return Response.redirect(url.toString(), 303);
}

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(request, false, 'Something went wrong. Please try again.');
  }

  // Honeypot: real people never see or fill this field.
  if ((form.get('website') || '').toString().trim() !== '') {
    return reply(request, true, "You're on the list.");
  }

  const email = (form.get('email') || '').toString().trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return reply(request, false, 'Please enter a valid email address.');
  }
  // Joining means agreeing to emails about our apps (stated under the form).
  // Older rows with 0 joined before that wording and only asked for the launch email.
  const futureApps = 1;
  const source = (form.get('source') || '').toString().slice(0, 80);

  if (!env.WAITLIST_DB) {
    return reply(request, false, "The waitlist isn't open yet. Please try again soon.", 503);
  }

  try {
    await env.WAITLIST_DB.prepare(
      `CREATE TABLE IF NOT EXISTS waitlist (
        email TEXT PRIMARY KEY,
        joined_at TEXT NOT NULL,
        source TEXT,
        future_apps INTEGER NOT NULL DEFAULT 0
      )`
    ).run();
    // Re-joining keeps the original date; a "future apps" yes is never silently removed (unsubscribing does that).
    await env.WAITLIST_DB.prepare(
      `INSERT INTO waitlist (email, joined_at, source, future_apps)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(email) DO UPDATE SET future_apps = MAX(future_apps, excluded.future_apps)`
    ).bind(email, new Date().toISOString(), source, futureApps).run();
  } catch (err) {
    console.error('waitlist insert failed', err);
    return reply(request, false, 'Something went wrong. Please try again.', 500);
  }

  return reply(request, true, "You're on the list. We'll email you a download link on launch day.");
}

export function onRequest({ request }) {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
}
