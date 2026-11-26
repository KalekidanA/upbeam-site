# Upbeam website

The marketing site and wake-up guides for Upbeam, the sunrise alarm clock for iPhone. Live at https://getupbeam.com.

Plain HTML and CSS, no build step. Cloudflare Pages deploys every push to `main` automatically.

## Layout

- `index.html` — home page
- `guides/` — one HTML file per guide, plus `guides/index.html` (the list)
- `privacy.html`, `support.html`
- `style.css` — shared styles
- `sitemap.xml`, `robots.txt` — for Google

## Adding a guide (what Cyber does each day)

1. Add `guides/<slug>.html`, copying the structure of an existing guide: canonical link, FAQ schema, short-version box, CTA at the end, related links, sources.
2. Add a card for it to `guides/index.html`, and remove it from "Coming soon" if it was listed there.
3. Link it from 1–2 related guides.
4. Add its URL to `sitemap.xml`.
5. Log it in `guides-log.csv`.

## Waitlist

The sign-up form (home page and the end of every guide) posts to `functions/api/waitlist.js`, a Cloudflare Pages Function. It stores sign-ups in a Cloudflare D1 database; nothing else is collected (no cookies, no IP addresses).

One-time setup in the Cloudflare dashboard:

1. **Storage & Databases › D1 › Create database**, name it `upbeam-waitlist`.
2. **Workers & Pages › upbeam › Settings › Bindings › Add › D1 database**: variable name `WAITLIST_DB`, database `upbeam-waitlist`. Add it for both **Production** and **Preview**.
3. Redeploy (or merge the next change). Until the binding exists, the form politely says the waitlist isn't open yet.

See the list: open the database in D1 and run `SELECT * FROM waitlist ORDER BY joined_at;`. Export it as CSV from the same screen when you choose an email tool. `future_apps = 1` means the person agreed to emails about your apps (everyone who joined after the checkbox was removed). `0` means they joined earlier and only asked for the launch email.

## Admin page (getupbeam.com/admin)

A private page listing every waitlist email, newest first, with totals, search, "Copy emails" and "Download CSV". It is locked with Cloudflare Access (Zero Trust, free for up to 50 users): only the emails you allow can sign in, using a one-time code sent to that inbox. The data comes from `functions/api/admin/waitlist.js`, which also checks the Access sign-in itself (`lib/access.js`), so the list can't be read from upbeam.pages.dev or preview links either. Until the setup below is done, the page shows "You need to sign in" and no emails.

One-time setup in the Cloudflare dashboard:

1. **Zero Trust** (left menu). The first time, pick a team name (e.g. `upbeam`) and the **Free** plan.
2. **Access › Applications › Add an application › Self-hosted.** Name: `Upbeam admin`. Add two public hostnames: `getupbeam.com` with path `admin`, and `getupbeam.com` with path `api/admin`. Add the same two for `www.getupbeam.com`.
3. **Policy:** name `Only me`, action **Allow**, include **Emails** → your admin email. Login method: **One-time PIN**. Save.
4. Copy two values: the application's **Application Audience (AUD) Tag** (on the application's overview), and your **team domain** (Zero Trust › Settings, e.g. `upbeam.cloudflareaccess.com`).
5. **Workers & Pages › upbeam › Settings › Variables and secrets** (Production): add `ACCESS_TEAM_DOMAIN` = the team domain, `ACCESS_AUD` = the AUD tag, `ADMIN_EMAILS` = your admin email (comma-separate several). Then redeploy.

## Emails: unsubscribing must be easy

Rules for every email sent to the waitlist or any future list (Cyber Sales follows these too):

- **Unsubscribe button in every email:** clearly visible in the footer, plus the one-click `List-Unsubscribe` and `List-Unsubscribe-Post` headers so Gmail and Apple Mail show their own Unsubscribe button.
- **Two steps at most:** the button opens a preferences page that already knows who the person is (no login, no retyping the email). They untick any category (Upbeam launch and updates, news about other apps, guides) or press **Unsubscribe from everything**, and it's done.
- **Clear categories:** each email belongs to one category, the footer says why the person is getting it, and people only get categories they signed up for.
- **Immediate:** an unsubscribe takes effect at once; no "allow 10 days", no "are you sure?" emails.
- **Easy way back:** the preferences page lets people re-subscribe.
- Footer always includes support@getupbeam.com and the sender's contact details, in line with CAN-SPAM and GDPR.

When an email tool is chosen, pick one that supports per-category preference pages and one-click unsubscribe headers.

## Caching

Pages link to `style.css?v=YYYYMMDD` and `waitlist.js?v=YYYYMMDD`. When you change either file, bump the date in every page (one search-and-replace) so visitors get the new version at once. `_headers` also tells browsers to re-check CSS and JS on each visit.
