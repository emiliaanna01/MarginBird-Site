# MarginBird website

Static build of the MarginBird canvas design. Pages are prerendered for SEO and hydrated with Preact.

- `src/pages/*.dc.html` — page sources, exported from the design canvas
- `transforms.mjs` — production edits applied at build time (forms, legal wording, links)
- `seo.json` — titles, descriptions, schema, llms.txt
- `static/` — icons, share image, `_headers`, `_redirects`

Build: `npm install && node build.mjs` → `dist/`
Turn on tracking: `GA4_ID=G-XXXX META_PIXEL_ID=123 node build.mjs` (a consent banner appears automatically).
Deploy: drag `dist/` onto the Deploys page of the `marginbird` project on Netlify.
