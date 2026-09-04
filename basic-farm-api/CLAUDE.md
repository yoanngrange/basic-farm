# CLAUDE.md — basic-farm-api

Context file for Claude Code. Read the root `basic-farm/CLAUDE.md` too (loaded
automatically alongside this one) for the platform-wide picture — this
file covers only what's specific to the API.

## Architecture recap (see root CLAUDE.md for the full rationale)

Monolith, single Postgres database, three schemas: `core` (users, farms,
users_farms, api_keys — shared), `jobs` (categories, listings, contacts —
recruitment-specific), and `plots` (cultures, parcels — parcel
management, farm-scoped). Two parallel auth models: JWT session auth for
the dashboard (`/api/core/*`, `/api/jobs/*`, `/api/plots/*`) and API-key
auth for the versioned public developer API (`/api/v1/*`, read-only for
now) — see the API keys section below. Hosting target: Clever Cloud.

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
- **`core.api_keys` is scoped to a farm, not a user.** Pricing/access is
  per-farm (see root CLAUDE.md), so an API key represents "this farm's
  data," and any user who manages the farm can create/revoke one — there
  is no per-user key. The raw key (`bf_...`) is shown exactly once, at
  creation; only a SHA-256 hash (`src/lib/tokens.js`, not bcrypt — API
  keys are high-entropy, not guessable passwords, so bcrypt's deliberate
  slowness would just tax every `/api/v1` request for no benefit) and a
  6-char preview are stored. **Hard-deleted on revoke, not soft-revoked**
  — a "revoked but still listed" row adds confusion without adding
  safety, since the key stops working the instant it's deleted either
  way. Capped at 20 keys/farm.
- **`/api/v1/*` is a separate, versioned, API-key-only surface** —
  distinct from the dashboard's own `/api/{core,jobs,plots}/*` routes,
  because third parties build against it and breaking it breaks their
  integration; the internal routes carry no such contract and can change
  freely. A key resolves straight to `req.apiKey.farmId`
  (`src/middleware/apiKeyAuth.js`) — **there is no `farmId` parameter
  anywhere in v1**, on purpose, so a key literally cannot address another
  farm's data even by passing a different id (verified: a stranger's key
  gets a 404, not a 403, on someone else's real parcel id — never confirm
  or deny another farm's data exists). **Read-only for now** — `scope`
  (`read`/`read_write`) is already on the schema for when write access
  lands, but nothing enforces `read_write` yet since no write route
  exists. Rate-limited separately from the dashboard's limiters
  (`RATE_LIMIT_V1_MAX`, per API key/IP, per minute — a public developer
  API is a real abuse surface).
- **OpenAPI spec is hand-authored** (`docs/openapi.yaml`), not
  generated from code — deliberate, since Express has no direct
  equivalent of Fastify's Zod-schema-to-OpenAPI transform, and a
  hand-written YAML gives direct control to put markdown `description:`
  prose between schema/path blocks (rendered by Swagger UI at
  `/api/v1/docs`, mounted public/unauthenticated in `src/app.js`). Keep
  new `/api/v1` endpoints and this file in sync manually — there's no
  build step that checks they match.

## Endpoints (see README.md for the full table)

`core`: auth (register/login/me), farms (CRUD + public profile at
`GET /core/farms/:id`), api-keys (`/core/farms/:farmId/api-keys` —
list/create/delete, `requireAuth` + farm-membership).
`jobs`: categories (locale-aware), listings (public browse with
language/country/category/**farmId** filters + pagination, `/mine` for
the dashboard, create/update), contacts (public submission + `/mine` for
the farmer), reveal-contact (captcha-gated).
`plots`: cultures (locale-aware, mirrors jobs categories), parcels —
dashboard side is farm-scoped (create/update/delete + `/mine?farmId=`,
`requireAuth`); also exposed read-only via `/api/v1/parcels`, API-key
auth, see the API keys design decision above.

## Testing

Jest + Supertest against a **real** Postgres instance (`basic_farm_ci`
db, needs PostGIS installed) — no mocking of the database layer.
`tests/globalSetup.js` drops/recreates `core`/`jobs`/`plots` from
`db/schema.sql` plus fixture categories and fixture cultures. Run:
```bash
createdb basic_farm_ci   # once
npm test
```
87 tests currently, all passing. When adding a feature, add tests in the
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
