# CLAUDE.md — ag (root)

Loaded automatically by Claude Code alongside whichever sub-repo's own
CLAUDE.md is in scope (`ag-api/CLAUDE.md` or `ag-web/CLAUDE.md`) — Claude
Code loads every CLAUDE.md from the working directory up through parent
directories at session start. This file holds what's true across the
whole platform; each sub-repo's own CLAUDE.md holds what's specific to it.

## What this is

**ag** is an agri-tech platform for farmers, built one product at a time
on a shared foundation. The first product: a plain-text, no-photo, no-CV
job board — recruitment is farmers' #1 problem, hence first. Planned next
(not started): machinery, invoices, clients, plots, weather. This
long-term multi-product intent is the reason the architecture separates
shared entities from product-specific ones from day one, not something
retrofitted later.

**Domain name is not final.** Never hardcode "agjob" or any specific
domain in code, repo names, table names, or config defaults. "ag" is the
internal codename only. The eventual public domain lives purely in env
vars / DNS / branding layers.

**Cost minimization has been a recurring, explicit priority** throughout
this project (GitHub Pages over Cellar specifically to avoid egress
costs; Brevo over Mailgun/SendGrid/Mandrill specifically for its free
tier at this volume; one Postgres/one Clever Cloud app rather than
per-module infrastructure). Weigh this before suggesting anything that
adds a paid tier or new piece of infrastructure.

## Repos

- **`ag-api`** — Express monolith + Postgres. `core` schema (users, farms
  — shared, reusable) + `jobs` schema (categories, listings, contacts —
  recruitment-specific). See `ag-api/CLAUDE.md`.
- **`ag-web`** — static-first frontend. SSG for public/indexable pages,
  CSR (vanilla JS) for the farmer dashboard. Deployed to GitHub Pages.
  See `ag-web/CLAUDE.md`.

Hosting target: **Clever Cloud** for `ag-api` + Postgres, **GitHub Pages**
for `ag-web`'s built `dist/`. Not deployed yet as of this writing —
everything has been run and verified locally (`LOCAL_SETUP.md`) or via
Docker Compose (`docker-compose.yml`, `DOCKER.md` — written but not
verified end-to-end, Docker wasn't available in the environment that
built it).

## The one architectural rule that matters most

Every future module (machinery, invoices, clients, plots, weather) gets
its **own schema in the same Postgres database**, referencing
`core.users`/`core.farms` by foreign key. It never gets its own database,
its own Clever Cloud add-on, or its own copy of user/farm logic. If a
change would violate this (e.g. duplicating farm data into a new module,
or suggesting a second database), stop and flag it rather than proceeding.

Related, not yet built: **farm selection should live on the main
dashboard hub** in `ag-web` (shared across every module), not be assumed
per-module. Right now the only module (`jobs`) hardcodes the user's first
farm — a known, flagged placeholder, not the intended design. Don't build
a second module's dashboard without addressing this first.

## Working style established in this project

- Every non-trivial change has been verified against a **real** running
  instance (real Postgres, real HTTP requests via curl/Supertest, real
  generated HTML inspected directly) — not just "the code looks right."
  This caught several real bugs (a category filter using the wrong slug,
  a rate limiter tripping the test suite that used it, `dotenv` not being
  loaded by a plain-Node script, `serve`'s clean-URL behavior breaking on
  UUID-heavy slugs). Keep doing this.
- Graceful degradation is a deliberate pattern for every third-party
  integration: captcha verification, email sending, and the GitHub
  rebuild trigger all no-op-and-log rather than throw when unconfigured,
  and never block the user-facing request they're attached to. Follow
  this pattern for any new integration.
