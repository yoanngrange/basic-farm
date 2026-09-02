# basic-farm-web

Frontend for the Basic Farm platform. Two rendering modes living in the same
`dist/` output, deployed together to GitHub Pages:

- **SSG** (static site generation): public, indexable pages — home/search,
  category pages, listing detail — generated at build time by
  `scripts/generate-static.mjs`, which calls the live API and writes plain
  HTML. Five locales (en, es, fr, it, pt). One canonical URL per listing
  at `/jobs/{slug}.html` (language-neutral path — a listing's content
  exists in one language only, so it is never duplicated per locale).
- **CSR** (client-side rendering): the farmer area — login, register,
  dashboard, new listing — built by Vite as a small multi-page app. Loads
  data from the API after authentication; not indexed (`noindex`).

Styling: [Pico.css](https://picocss.com) (classless — styles semantic HTML
directly, no utility-class soup), no JS framework, no build-time UI kit
beyond Vite bundling the CSR pages.

## Structure

```
login.html, register.html, dashboard.html, listing-new.html   CSR entry points (built by Vite)
src/
  pages/          JS for each CSR page above
  lib/            i18n loader, API client, auth/session helpers
  i18n/           en.json, es.json, fr.json, it.json, pt.json
  styles/         main.css (on top of Pico)
  static-assets/  vanilla JS shipped as-is (not bundled) to SSG pages:
                  contact-widget.js, reveal-contact-widget.js
scripts/
  generate-static.mjs   SSG entrypoint
  templates.mjs         HTML string templates (page shell, listing card,
                         JobPosting JSON-LD, contact widgets)
  lib-helpers.mjs        small fetch/escape helpers
```

## Run locally

```bash
npm install
cp .env.example .env   # point VITE_API_BASE_URL at a running basic-farm-api
npm run dev             # CSR pages only, with hot reload
npm run build            # vite build (CSR) + generate-static.mjs (SSG) into dist/
npm run generate:static  # just the SSG step, against a running API
```

`basic-farm-api` must be running (and its DB migrated/seeded) for both `dev` and
`generate:static` — the frontend has no data of its own.

## Reveal contact button (captcha)

Farm public contact info (`contact_email`/`contact_phone`) is hidden behind
a Cloudflare Turnstile challenge — see `basic-farm-api`'s README for the server
side. Set `TURNSTILE_SITE_KEY` (public key, safe to commit to CI env) before
running `generate:static`; if unset, the button is omitted from generated
pages and the classic contact form (no captcha, logs to `listing_contacts`)
remains the only contact path.

## Deploying to GitHub Pages

This repo lives in the `basic-farm` monorepo, so the workflow is at the
repo root: `.github/workflows/deploy-web.yml`. It builds and publishes
`basic-farm-web/dist/` automatically on every push to `main` that touches
`basic-farm-web/**` (or manually via "Run workflow").

One-time repo setup required:
1. **Settings → Pages → Source**: select "GitHub Actions" (not a branch).
2. **Settings → Secrets and variables → Actions**, add:
   - `API_BASE_URL` — the deployed `basic-farm-api` URL (Clever Cloud, e.g.
     `https://basic-farm-api.example.cleverapps.io/api` today; will become
     `https://api.basic-farm.com/api` once that custom domain is attached)
   - `TURNSTILE_SITE_KEY` — optional; omit to ship without the reveal-contact button

Both values get baked into the static build at build time (that's how a
static site works — there's no runtime config), so redeploy whenever
either changes.

`BASE_PATH` and `SITE_ORIGIN` are set directly in the workflow (not
secrets) because this deploys as a GitHub Pages *project* page
(`https://<user>.github.io/basic-farm/`), not a custom domain — every
generated link needs the `/basic-farm` prefix. Drop both (and the
workflow env lines) once `basic-farm.com` is attached as a custom domain,
since that serves from `/`.

## Known simplification: farm selection

Right now `dashboard-jobs.js` (and any future per-module dashboard) assumes
a single farm and silently manages `farms[0]`. This is a placeholder, not
the intended design.

**Planned change**: farm selection belongs on the main dashboard hub
(`dashboard.html`), not inside each module. The hub should let a user with
multiple farms pick which one is "active" (e.g. a switcher in the header,
persisted in session/localStorage), and every module dashboard (Jobs today,
Machinery/Invoices/Clients/Plots/Weather later) should read that selection
rather than each independently defaulting to farms[0]. This is core-level
shared state, not a jobs-specific concern — same reasoning as keeping
`core.users`/`core.farms` in their own schema rather than duplicating farm
logic per module.
