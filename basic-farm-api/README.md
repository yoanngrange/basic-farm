# basic-farm-api

Monolithic Express API for the Basic Farm platform. First module: `jobs` (recruitment).
`core` (users, farms) is shared and meant to be reused by future modules
(equipment, weather, regulatory...) living in the same database, same app.

## Structure

```
src/
  config/env.js        env vars, fails fast if something required is missing
  db/pool.js            single pg Pool for the whole app
  lib/logger.js         pino structured logger (JSON to stdout)
  lib/errors.js         AppError hierarchy (Validation/Auth/Forbidden/NotFound/Conflict)
  lib/slug.js            listing slug generation (uuid + slugified title)
  middleware/
    requestLogger.js    pino-http, correlation id (X-Request-Id), redacts Authorization
    errorHandler.js     single place that logs + formats every error response
    auth.js              JWT verification, attaches req.user
    asyncHandler.js      wraps async route handlers
  modules/
    core/                users, farms — shared across all future products
    jobs/                categories, listings, contacts — recruitment only
  routes/index.js        mounts /api/core/* and /api/jobs/*
  app.js                 express app wiring
  server.js               entrypoint, graceful shutdown on SIGTERM/SIGINT
```

## Logging

Everything logs as structured JSON to stdout — no file, no custom log
storage. Clever Cloud captures stdout natively (`clever logs`, or a log
drain to Elasticsearch/Datadog later) with zero code change needed.

- Every request gets a correlation id (`X-Request-Id`, reused if the
  caller already sent one) — every log line for that request carries it.
- `req.log` is available in every controller/service to log business
  events with context (e.g. `req.log.info({ listingId }, "Listing created")`).
- Sensitive fields (`Authorization` header, passwords, tokens) are
  automatically redacted, never written to logs.
- Errors log once, centrally, in `errorHandler.js`: operational errors
  (`AppError`, e.g. bad input, forbidden) log at `warn` with their real
  message; unexpected errors log at `error` with the stack trace, but
  the client only ever sees a generic message in production.

## Run locally

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL etc.
npm run dev             # pretty-printed logs
# or: npm start          # raw JSON logs, closer to production
```

## Deploy on Clever Cloud

Set these as environment variables on the app (never commit a `.env`):
`DATABASE_URL` (provided automatically if the Postgres add-on is linked),
`JWT_SECRET`, `JWT_EXPIRES_IN`, `LOG_LEVEL`, `CORS_ORIGIN`, `NODE_ENV=production`.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET  | /health | — | health check |
| POST | /api/core/auth/register | — | rate-limited |
| POST | /api/core/auth/login | — | rate-limited |
| GET  | /api/core/auth/me | JWT | |
| POST | /api/core/farms | JWT | creates farm + owner link |
| GET  | /api/core/farms/mine | JWT | |
| PATCH| /api/core/farms/:id | JWT | owner/manager only |
| GET  | /api/jobs/categories?locale=xx | — | |
| GET  | /api/jobs/listings?language=&country=&category=&status=&page=&pageSize= | — | public browsing, paginated |
| GET  | /api/jobs/listings/:slug | — | increments view_count |
| POST | /api/jobs/listings | JWT | must manage the target farm |
| PATCH| /api/jobs/listings/:id | JWT | must manage the listing's farm |
| POST | /api/jobs/listings/:listingId/contacts | — | rate-limited, no account needed |

## Tests

Integration tests (Jest + Supertest) run against a real Postgres instance —
no mocking of the database layer, so a broken query or a schema mismatch
actually fails a test.

```bash
createdb basic_farm_ci
npm test
```

`tests/globalSetup.js` drops and recreates the `core`/`jobs` schemas from
`db/schema.sql` before the run, plus two fixture categories (with fr/en/it
translations) reused read-only across every test file. `tests/helpers/reset.js`
wipes tenant data (users, farms, listings, contacts) between individual tests
so they stay isolated, without re-running the schema each time.

CI runs the same suite on every push/PR via `.github/workflows/ci.yml`,
against a disposable Postgres 16 service container — see that file for the
exact env vars it sets (notably higher rate-limit ceilings than production,
since tests legitimately hit `/register`/`/login` many times in a row against
one shared in-memory limiter).

## Reveal contact (captcha-gated)

`GET /api/jobs/listings/:id/reveal-contact?captchaToken=...` returns a farm's
public `contact_email`/`contact_phone` (set via `POST /api/core/farms` or
`PATCH /api/core/farms/:id`) — but only after server-side verification of a
Cloudflare Turnstile token. The regular public listing endpoints never select
these two columns, so this endpoint is the only path that can expose them.

Env vars: `TURNSTILE_SECRET_KEY` (server secret, required in production).
In dev/test, if unset, verification is bypassed (any token except the
literal string "invalid" is accepted) so local dev and CI don't need real
Cloudflare credentials — this bypass is disabled automatically whenever
`NODE_ENV=production`.

The frontend needs the matching **site key** (public, safe to expose) as
`TURNSTILE_SITE_KEY` when running `scripts/generate-static.mjs` in `basic-farm-web`.
If unset, the reveal-contact button is simply omitted from generated pages —
the regular contact form still works.

## Farmer email notifications (Brevo)

Whenever a candidate contacts a listing (any contact_type), the listing's
author (job_listings.user_id -> core.users.email, the private login email,
not the public contact_email used by reveal-contact) gets a notification
email with the candidate's email/message if provided.

Sent via Brevo's SMTP relay (works through the generic nodemailer setup in
src/lib/mailer.js, no Brevo-specific code). If SMTP_HOST is unset, sending
is skipped and logged as a warning - the candidate's request still succeeds
either way; email delivery is best-effort and never blocks or fails the
API response.

Chosen over Mailgun/SendGrid/Mandrill for this app's volume: Brevo's free
tier is 300 emails/day (~9,000/month) with no expiry - comfortably covers
candidate-contact notifications at zero cost, and Brevo hosts in the EU by
default, consistent with keeping farmer/candidate data in Europe.

Setup:
1. Create a free Brevo account (no credit card required). Optionally
   verify a sending domain (Senders, Domains & Dedicated IPs) for better
   deliverability - not required to start sending.
2. Settings > SMTP & API > SMTP tab: generate an SMTP key. This is NOT
   your Brevo account password - copy it immediately, it's shown once.
3. Set env vars (see .env.example): SMTP_HOST=smtp-relay.brevo.com,
   SMTP_PORT=587, SMTP_USER=<your Brevo login email>, SMTP_PASS=<the SMTP
   key>, EMAIL_FROM (an address on your verified domain, or your Brevo
   account email while testing).
4. On Clever Cloud, store SMTP_PASS as an app env var (never commit it),
   the same way JWT_SECRET and TURNSTILE_SECRET_KEY are handled.

Note: the 300/day cap applies to the whole account, not per domain/sender.
If volume ever grows past that (unlikely for contact notifications alone),
Brevo's paid tiers are credit-based and still competitive - re-check
pricing before committing long-term, as with any provider.

## Public farm profile and farm listings

GET /api/core/farms/:id - public, no auth. Returns non-sensitive farm
fields only (name, country_code, farm_type, locality, region, website,
description) - never contact_email, contact_phone, or registration_number.

GET /api/jobs/listings?farmId=... - the existing public listings endpoint
now also accepts a farmId filter, combinable with the others (language,
country, category, status, pagination). Together these two endpoints are
what a future farm profile page would use.

## Automatic site rebuild (keeps sitemap.xml in sync)

Since basic-farm-web is a static site, it only reflects reality after a rebuild.

Whenever a listing's status changes via PATCH /api/jobs/listings/:id (a
listing being published, filled, expired, or archived — i.e. added to or
removed from public view), the API fires a GitHub repository_dispatch
event (event_type listing-changed) against basic-farm-web's repo. basic-farm-web's
deploy.yml listens for that event and reruns the full build, which
regenerates every page plus sitemap.xml and robots.txt from current data.

Like the mailer and captcha verification, this is fire-and-forget: a
GitHub API failure never blocks or fails the farmer's request. If
GITHUB_DISPATCH_TOKEN or GITHUB_DISPATCH_REPO is unset, the trigger is
skipped and logged instead. See .env.example for the required token scope.

Note: this does NOT rebuild on every write — only on status transitions,
since those are the only changes that affect what's publicly visible.
Editing a published listing's title/description without changing status
does not currently trigger a rebuild (the change won't show on the static
site until the next rebuild for another reason, or a manual one).
