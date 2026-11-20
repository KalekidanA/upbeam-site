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
