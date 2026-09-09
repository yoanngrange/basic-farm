# CLAUDE.md — basic-farm-web

Context file for Claude Code. Read the root `basic-farm/CLAUDE.md` too (loaded
automatically alongside this one) for the platform-wide picture — this
file covers only what's specific to the frontend.

## Recap: two rendering modes, one `dist/`

- **SSG** (static site generation): public, indexable pages — home/search
  per locale, category pages per locale, canonical listing detail pages —
  generated at build time by `scripts/generate-static.mjs`, which calls
  the live API and writes plain HTML. Five locales: en, es, fr, it, pt.
- **CSR** (client-side rendering): the farmer area — login, register,
  dashboard (hub), dashboard-jobs (jobs module), listing-new (create/edit)
  — built by Vite as a small multi-page vanilla-JS app, `noindex`.

Both land in the same `dist/`, deployed together to GitHub Pages via
`.github/workflows/deploy.yml`.

## Key design decisions and why

- **Styling: Pico.css (classless), not Bootstrap.** Chosen specifically
  because it styles semantic HTML directly without wrapping everything in
  `div.container > div.row > div.col-*` — matches the original
  requirement of clean, semantically-correct, easily-indexed HTML.
  ~10KB vs Bootstrap's ~200KB. Don't introduce a heavier CSS/JS framework
  without discussing — "basique, fonctionnel, épuré, pas d'identité pour
  le moment" is the explicit brief.
- **Vanilla JS, no framework, for the CSR farmer area.** Deliberate choice
  to stay minimal, consistent with the static-first philosophy.
- **One canonical URL per listing** at `/jobs/{slug}.html` — NOT under
  `/{locale}/` — because a listing's content exists in exactly one
  language and is never translated. Duplicating it per UI locale would be
  duplicate content for SEO. Don't add per-locale listing URLs.
- **hreflang + language switcher ARE used on index/category/farm-profile
  pages** (legitimate per-locale variants — same data, translated UI) but
  deliberately NOT on listing detail pages (single-language content, no
  real translation exists). The switcher there falls back to linking each
  locale's homepage instead.
- **Farm profile pages** (`/{locale}/farm/{farmId}.html`, one per locale ×
  farm with at least one published listing) show ALL published listings
  for that farm regardless of language — not filtered to the page's own
  locale. This is intentional; don't "fix" it to filter by language.
- **sitemap.xml/robots.txt are generated fresh on every build**, driven by
  `basic-farm-api`'s GitHub `repository_dispatch` trigger whenever a listing's
  public visibility changes (see basic-farm-api's CLAUDE.md). Every `writeFile()`
  call in `generate-static.mjs` pushes to a `sitemapUrls` array unless
  `{ indexable: false }` is passed (used for noindex/meta pages).
- **`SSG_API_BASE_URL` vs `VITE_API_BASE_URL`**: two different env vars on
  purpose. `VITE_API_BASE_URL` gets baked into the browser-facing CSR
  bundle by Vite — must be reachable from the visitor's browser.
  `SSG_API_BASE_URL` (falls back to `VITE_API_BASE_URL` if unset) is used
  only by `generate-static.mjs`'s build-time fetches — matters in Docker
  Compose, where the SSG step runs inside a container and must reach the
  API via its internal service hostname (`http://api:3000/api`) while the
  browser needs `http://localhost:3000/api`. Don't collapse these back
  into one variable.
- **Reveal-contact widget only renders if `TURNSTILE_SITE_KEY` is set at
  build time** (`revealContactWidget()` in `templates.mjs` returns `""`
  otherwise). Graceful degradation, not a broken button — preserve this.
- **`serve.json` sets `cleanUrls: false`.** Found during real local
  testing: `serve`'s default clean-URL rewriting mis-resolves listing
  slugs (they contain a UUID + many hyphens) and serves a directory
  listing instead of the page. If you introduce a different static server
  for local testing or Docker, verify it doesn't have the same issue —
  `python3 -m http.server` was confirmed to serve everything correctly
  and is the recommended fallback.
- **Dashboard is a hub, not a jobs-specific page.** `dashboard.html` links
  to per-module dashboards ("Jobs" — `dashboard-jobs.html` —, "Weather" —
  `dashboard-weather.html` —, "Plots" — `dashboard-plots.html` — and
  "Équipe" — `dashboard-team.html` — are functional; Machinery/Invoices/
  Clients are still disabled placeholders). Farm CRUD (logo, name,
  address, country, public contact email/phone) still lives inside
  `dashboard-jobs.html`, but **farm selection now lives on the hub**
  (`src/lib/farmContext.js` + `dashboard.js`'s farm switcher, shown only
  when the user has 2+ farms) — every module page reads the persisted
  choice via `farmContext.resolveCurrentFarm(farms)` instead of
  hardcoding `farms[0]`. Built 2026-09-09, specifically because a second
  and third module (Parcelles' frontend, Weather) were about to be added
  and the project's own CLAUDE.md flags this as a hard prerequisite
  before that happens.
- **`api-keys.html` isn't a product module** (unlike the Jobs/Weather/...
  grid) — it's account/integration settings, linked as a plain link from
  the hub rather than a module card. Manages `core.api_keys`
  (farm-scoped, not per-user — see `basic-farm-api/CLAUDE.md`), and links
  out to `/api/v1/docs` (Swagger UI for the public developer API). Uses
  the same `farmContext.resolveCurrentFarm()` as every other module page.
- **`dashboard-weather.html`** — city search (autocomplete against
  `GET /weather/locations/search`, worldwide, debounced 300ms), saved
  locations as cards (current conditions + 7-day daily table + "last
  updated" timestamp + manual refresh button). The backend
  auto-refreshes any cache older than `WEATHER_CACHE_TTL_MINUTES` on
  every `GET /mine`, so "as fresh as possible" needs no polling/websocket
  on this side — the page just re-fetches the list. WMO weather codes are
  mapped to a small emoji set (`WEATHER_ICONS` in
  `src/pages/dashboard-weather.js`), not exhaustive, good enough for v1.
- **`dashboard-team.html`** — the product-facing label is "Équipe" even
  though the backend schema/module is `personnel` (see
  `basic-farm-api/CLAUDE.md`) — deliberate naming choice, don't rename
  one to match the other. People are listed in an editable table (each
  cell is its own input/select, patched on change — same inline-edit
  pattern as `dashboard-plots.js`'s parcel list); "add several at once"
  is a client-side textarea parsed as `First, Last, Role` per line, not
  a file upload — there's no CSV parsing anywhere in this app. Teams show
  members as removable chips plus a select-and-add control fed by
  whichever people aren't already in that team.

## File map

```
login.html, register.html, dashboard.html, dashboard-jobs.html,
listing-new.html, api-keys.html, dashboard-weather.html,
dashboard-plots.html, dashboard-team.html   CSR entry points
                            (built by Vite, see vite.config.js)
src/pages/*.js             one file per CSR page above
src/lib/                   i18n loader, API client (api.js), auth/session
                            helpers (auth.js, localStorage-based — fine here,
                            this isn't a claude.ai artifact), farmContext.js
                            (shared "current farm" selection, see below)
src/i18n/{en,es,fr,it,pt}.json   UI string translations
src/styles/main.css         small additions on top of Pico
src/static-assets/          vanilla JS shipped as-is (not bundled) to SSG
                            pages: contact-widget.js, reveal-contact-widget.js
scripts/generate-static.mjs  SSG entrypoint — reads this file first when
                             touching anything public-facing
scripts/templates.mjs        HTML string templates (page shell w/ hreflang +
                              switcher, listing card, JobPosting JSON-LD,
                              contact widgets, farm profile, 404)
scripts/lib-helpers.mjs       fetch/escape helpers, LOCALES constant
```

## Testing / verification approach

There's no automated test suite for this repo (unlike basic-farm-api's Jest
suite) — verification has been done by actually running
`npm run build` + `generate:static` against a live `basic-farm-api` with real
seeded data, then inspecting generated HTML directly (grep/cat), plus
simulating full user flows via `curl` against the API in the exact
sequence each page's JS performs. If you add a non-trivial feature here,
verify it the same way: run the real build against a real API, read the
actual generated output, don't just trust that the code "looks right" —
this approach already caught several real bugs (category filter using
the wrong slug, dotenv not being loaded by the plain-Node SSG script,
`serve`'s clean-URL bug).

## Known gaps / intentionally deferred

- ~~Farm selection is hardcoded to `farms[0]`~~ — fixed 2026-09-09, see
  `src/lib/farmContext.js` above. Farm CRUD itself (the form to
  create/edit a farm's details) still lives inside `dashboard-jobs.html`
  rather than the hub — only *selecting* an existing farm moved, not
  managing one. Move CRUD to the hub too if a module ships that needs it
  before Jobs does.
- No file upload for farm logo — it's a plain URL field.
- No password reset flow.
- GitHub Pages deploy workflow (`deploy.yml`) accepts both `push` and
  `repository_dispatch` (from basic-farm-api) but has not been tested against a
  real deployed basic-farm-api / real GitHub repo yet — everything so far has run
  against `localhost`.
- A `Dockerfile` + root-level `docker-compose.yml` exist (compose file
  delivered separately, not inside this repo by default) but were
  authored without Docker available to actually test them — treat as
  unverified until run once successfully.

## Local dev

See `LOCAL_SETUP.md` (delivered separately) for running this alongside
`basic-farm-api` without Docker — the path currently in active use.
