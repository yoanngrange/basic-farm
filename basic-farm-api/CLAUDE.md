# CLAUDE.md — basic-farm-api

Context file for Claude Code. Read the root `basic-farm/CLAUDE.md` too (loaded
automatically alongside this one) for the platform-wide picture — this
file covers only what's specific to the API.

## Architecture recap (see root CLAUDE.md for the full rationale)

Monolith, single Postgres database, three schemas: `core` (users, farms,
users_farms — shared), `jobs` (categories, listings, contacts —
recruitment-specific), and `plots` (cultures, parcels — parcel
management, all 100% private/per-farm, no public surface unlike jobs).
Hosting target: Clever Cloud.

## Key design decisions and why

- **Farm public profile excludes `contact_email`/`contact_phone`/
  `registration_number`.** Those are private by default. Public exposure
  of contact info goes through a separate, captcha-gated endpoint (see
  below) — never through the regular public listing/farm endpoints. There
  is a test (`never leaks contact info through the regular public listing
  fetch`) that guards this; do not weaken it.
- **`job_listings.slug` embeds the row's own UUID** as a prefix
  (`{uuid}-{slugified-title}`). This means slugs can never collide and
  stay valid even if the title changes after publication. Don't switch to
  title-only slugs.
- **A listing exists in exactly one language, never translated.**
  Multilingual support (en/es/fr/it/pt) applies to UI strings and to
  `job_category_translations` only. There is deliberately no
  `job_listings_translations` table. Don't add one without discussing —
  the SEO strategy (one canonical URL per listing, no per-locale
  duplicates) depends on this.
- **Captcha (Cloudflare Turnstile) gates `GET /jobs/listings/:id/reveal-contact`.**
  Verification happens server-side only (`src/lib/captcha.js`). In
  dev/test (`NODE_ENV !== 'production'` and `TURNSTILE_SECRET_KEY` unset),
  verification is bypassed — any token except the literal string
  `"invalid"` is accepted. This bypass is automatically disabled in
  production; don't touch that guard.
- **Farmer notification emails are best-effort, fire-and-forget, and
  never throw.** `src/lib/mailer.js` no-ops (logs a warning) if
  `SMTP_HOST` is unset. Provider is **Brevo** (SMTP relay,
  `smtp-relay.brevo.com`), chosen over Mailgun/SendGrid/Mandrill
  specifically because its free tier (300/day, no expiry) actually covers
  this app's low volume at zero cost — the others don't have a usable
  free production tier anymore. Uses generic SMTP via `nodemailer`, so
  swapping providers is just env vars, no code change.
- **Site rebuilds are triggered via GitHub `repository_dispatch`**
  (`src/lib/githubDispatch.js`), fired from `updateStatusOrContent`
  whenever a status change occurs OR content is edited on an
  already-`published` listing. This is what keeps the static site's
  `sitemap.xml` in sync automatically. Also fire-and-forget, never blocks
  the farmer's request, skipped (logged) if unconfigured.
- **Structured JSON logs to stdout only** (pino), no file-based logging,
  no custom log storage — Clever Cloud captures stdout natively. Every
  request gets a correlation id (`X-Request-Id`). Sensitive fields
  (Authorization header, passwords, tokens) are redacted automatically.
- **Rate limits are configurable via env vars**
  (`RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_CONTACT_MAX`, `RATE_LIMIT_REVEAL_MAX`)
  specifically because the test suite legitimately hits `/register`/`/login`
  many times against one shared in-memory limiter — this was a real bug
  once (limiter tripped mid test-run). Test/CI env sets these very high.
- **`plots.parcels.geom` is a real polygon (PostGIS `geography(Polygon,
  4326)`), never a point.** Needed for accurate area, future NDVI-style
  analysis, and showing seasonal workers exactly where a parcel's extent
  is. `area_ha` is a `GENERATED ALWAYS ... STORED` column computed from
  `geom` via `ST_Area` — never accept/store a manually-entered surface
  value. Verified `ST_Area(geography, boolean)` is `IMMUTABLE` (required
  for generated columns) against the real prod DB before building this;
  don't assume other PostGIS functions are IMMUTABLE without checking
  `pg_proc.provolatile` first. `culture_id` is a required-shape FK into
  `plots.cultures` — never accept free-text culture names.
- **`locality`/`country_code` on a parcel are reverse-geocoded, not
  entered by hand** (`src/lib/geocode.js`, via Nominatim/OpenStreetMap —
  free, no API key). Best-effort like captcha/mailer/githubDispatch:
  failures/timeouts leave both fields `null`, never block saving the
  parcel. **Bypassed entirely when `NODE_ENV=test`** (returns a fixed
  stub) — Nominatim's public instance rate-limits to ~1 req/sec and a
  real network call has nothing useful to assert in a test anyway; don't
  remove that guard or tests will start hitting the real API.
- **PostGIS is a hard requirement**, not optional — `schema.sql` does
  `CREATE EXTENSION postgis`. Confirmed already installed on the Clever
  Cloud Postgres add-on (v3.3.3) with no plan/cost change needed. Local
  dev needs `brew install postgis` (or the `postgis/postgis` Docker
  image instead of plain `postgres`); CI's service container uses
  `postgis/postgis:16-3.4` for the same reason — don't revert either to
  a plain postgres image.

## Endpoints (see README.md for the full table)

`core`: auth (register/login/me), farms (CRUD + public profile at
`GET /core/farms/:id`).
`jobs`: categories (locale-aware), listings (public browse with
language/country/category/**farmId** filters + pagination, `/mine` for
the dashboard, create/update), contacts (public submission + `/mine` for
the farmer), reveal-contact (captcha-gated).
`plots`: cultures (locale-aware, mirrors jobs categories), parcels — 100%
private/farm-scoped, no public endpoint at all (create/update/delete +
`/mine?farmId=`, all `requireAuth` + farm-membership checked).

## Testing

Jest + Supertest against a **real** Postgres instance (`basic_farm_ci`
db, needs PostGIS installed) — no mocking of the database layer.
`tests/globalSetup.js` drops/recreates `core`/`jobs`/`plots` from
`db/schema.sql` plus fixture categories and fixture cultures. Run:
```bash
createdb basic_farm_ci   # once
npm test
```
73 tests currently, all passing. When adding a feature, add tests in the
matching style — real DB, `supertest` against the exported `app`, spy on
`mailer.js`/`githubDispatch.js` via their module object (not destructured
imports) when asserting fire-and-forget side effects.

## Known gaps / intentionally deferred

- No password reset flow.
- No endpoint yet for listing all annonces of a specific farm filtered by
  something other than `farmId` (country/category cross-filter on a farm
  profile) — not requested yet.
- Farm selection UI: currently every per-module dashboard (just `jobs` so
  far) assumes the user's *first* farm. The intended design (not yet
  built) is a farm switcher on the main dashboard hub, shared by every
  module — this is `core`-level concern, not jobs-specific. See basic-farm-web's
  CLAUDE.md for the frontend side of this.

## Local dev

See `README.md` in this repo, and `LOCAL_SETUP.md` (delivered separately,
covers running basic-farm-api + basic-farm-web together). Postgres native or Docker both
work; a `docker-compose.yml` also exists (delivered separately, untested
end-to-end — Docker wasn't available where it was built).
