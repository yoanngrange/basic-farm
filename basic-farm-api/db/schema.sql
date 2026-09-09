-- =========================================================
-- Platform schema (PostgreSQL) — single monolithic database
--
-- One Postgres instance, one Express app, one deploy. "core" and
-- "jobs" are namespaces inside THIS SAME database, not separate
-- services or separate databases. "core" holds entities shared
-- across every future tool (identity, farms). "jobs" holds
-- everything specific to the recruitment product — the first tool
-- being built. Future products (equipment, weather, regulatory...)
-- get their own schema in this same database and simply reference
-- core.users / core.farms by FK, without ever touching core or jobs.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS jobs;
CREATE SCHEMA IF NOT EXISTS plots;
CREATE SCHEMA IF NOT EXISTS weather;
CREATE SCHEMA IF NOT EXISTS personnel;

-- =========================================================
-- core.users — farmer accounts, shared by every product
-- (candidates never create one, whatever the product)
-- =========================================================
CREATE TABLE core.users (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                       VARCHAR(255) NOT NULL UNIQUE,
    password_hash               VARCHAR(255) NOT NULL,
    phone                       VARCHAR(20),
    first_name                  VARCHAR(100) NOT NULL,
    last_name                   VARCHAR(100) NOT NULL,
    email_verified               BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token     VARCHAR(255),
    terms_accepted_at            TIMESTAMPTZ,
    status                       VARCHAR(20) NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at                TIMESTAMPTZ
);

-- =========================================================
-- core.farms — shared by every product (jobs today, equipment/
-- weather/regulatory tomorrow all hang off the same farm record)
-- =========================================================
CREATE TABLE core.farms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    registration_number VARCHAR(50),
    country_code        CHAR(2) NOT NULL,
    farm_type           VARCHAR(50)
                        CHECK (farm_type IN ('crop', 'livestock', 'mixed', 'market_garden', 'viticulture', 'orchard', 'other')),
    address_line        VARCHAR(255),
    postal_code         VARCHAR(20),
    locality             VARCHAR(100),
    region               VARCHAR(100),
    latitude             DECIMAL(9,6),
    longitude            DECIMAL(9,6),
    website              VARCHAR(255),
    logo_url              VARCHAR(255),
    description          TEXT,
    -- Public-facing contact info, shown only after captcha verification
    -- (see jobs.job_listings /:id/reveal-contact). Deliberately separate
    -- from core.users.email (login credential, never public).
    contact_email         VARCHAR(255),
    contact_phone         VARCHAR(20),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- core.users_farms — many-to-many, shared by every product
-- =========================================================
CREATE TABLE core.users_farms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    farm_id     UUID NOT NULL REFERENCES core.farms(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'owner'
                CHECK (role IN ('owner', 'manager')),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, farm_id)
);

CREATE INDEX idx_core_farms_country_code ON core.farms(country_code);

-- =========================================================
-- core.api_keys — lets a farm expose its own data to third-party
-- tools/integrations (the "intégrable dans les deux sens" requirement),
-- separate from the JWT session auth used by the dashboard. Scoped to a
-- farm (not a user) since pricing/access is per-farm, not per-seat.
-- Hard-deleted on revoke, not soft-revoked: a "revoked but still listed"
-- row adds confusion without adding safety, since the key is unusable
-- either way the moment it's gone from here.
-- =========================================================
CREATE TABLE core.api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES core.farms(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES core.users(id) ON DELETE SET NULL,
    name            VARCHAR(100) NOT NULL,
    scope           VARCHAR(20) NOT NULL DEFAULT 'read'
                    CHECK (scope IN ('read', 'read_write')),
    key_hash        VARCHAR(64) NOT NULL UNIQUE,
    key_preview     VARCHAR(6) NOT NULL,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_core_api_keys_farm ON core.api_keys(farm_id);

-- =========================================================
-- jobs.job_categories — specific to the recruitment product
-- =========================================================
CREATE TABLE jobs.job_categories (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label   VARCHAR(100) NOT NULL UNIQUE,
    slug    VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE jobs.job_category_translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES jobs.job_categories(id) ON DELETE CASCADE,
    locale          VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'es', 'fr', 'it', 'pt')),
    label           VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    UNIQUE (category_id, locale),
    UNIQUE (locale, slug)
);

-- =========================================================
-- jobs.job_listings — specific to the recruitment product,
-- references core.farms / core.users
-- =========================================================
CREATE TABLE jobs.job_listings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id             UUID NOT NULL REFERENCES core.farms(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES core.users(id),
    category_id         UUID REFERENCES jobs.job_categories(id),

    title               VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,
    slug                VARCHAR(255) NOT NULL UNIQUE,
    language            VARCHAR(5) NOT NULL DEFAULT 'en'
                        CHECK (language IN ('en', 'es', 'fr', 'it', 'pt')),

    published_at        DATE,
    start_date          DATE,
    duration_value       INTEGER,
    duration_unit        VARCHAR(10) CHECK (duration_unit IN ('day', 'week', 'month', 'season')),

    status               VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'filled', 'expired', 'archived')),
    expires_at           DATE,

    view_count            INTEGER NOT NULL DEFAULT 0,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_listings_status ON jobs.job_listings(status);
CREATE INDEX idx_jobs_listings_farm ON jobs.job_listings(farm_id);
CREATE INDEX idx_jobs_listings_published_at ON jobs.job_listings(published_at);
CREATE INDEX idx_jobs_listings_language ON jobs.job_listings(language);
CREATE INDEX idx_jobs_listings_category ON jobs.job_listings(category_id);

-- =========================================================
-- jobs.listing_contacts — specific to the recruitment product
-- =========================================================
CREATE TABLE jobs.listing_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      UUID NOT NULL REFERENCES jobs.job_listings(id) ON DELETE CASCADE,
    contact_type    VARCHAR(20) NOT NULL
                    CHECK (contact_type IN ('email', 'phone_click', 'contact_form')),
    candidate_email VARCHAR(255),
    message         TEXT,
    ip_hash         VARCHAR(64),
    contacted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_listing_contacts_listing ON jobs.listing_contacts(listing_id);

-- =========================================================
-- plots.cultures — reference list of crops. Lives in the "plots"
-- schema (not "core") because it's introduced by the parcels product,
-- but nothing stops a future module (calendrier de cultures,
-- traitements...) from referencing it by FK the same way jobs
-- references core.farms.
-- =========================================================
CREATE TABLE plots.cultures (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label   VARCHAR(100) NOT NULL UNIQUE,
    slug    VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE plots.culture_translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    culture_id      UUID NOT NULL REFERENCES plots.cultures(id) ON DELETE CASCADE,
    locale          VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'es', 'fr', 'it', 'pt')),
    label           VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    UNIQUE (culture_id, locale),
    UNIQUE (locale, slug)
);

-- =========================================================
-- plots.parcels — specific to the parcels product, references
-- core.farms. A parcel's boundary is a real polygon (not a point):
-- needed for accurate area, NDVI-style analysis later, and showing
-- seasonal workers exactly where a parcel's extent is. area_ha is
-- ALWAYS derived from the shape (ST_Area is IMMUTABLE for geography,
-- verified against the real DB before writing this), never entered by
-- hand. locality/country_code are populated via reverse geocoding at
-- creation/update time (see src/lib/geocode.js) — best-effort, nullable
-- if the geocoding call fails, never blocks saving the parcel.
-- =========================================================
CREATE TABLE plots.parcels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES core.farms(id) ON DELETE CASCADE,
    culture_id      UUID REFERENCES plots.cultures(id),

    name            VARCHAR(200) NOT NULL,
    geom            geography(Polygon, 4326) NOT NULL,
    area_ha         NUMERIC GENERATED ALWAYS AS (ST_Area(geom) / 10000.0) STORED,

    locality        VARCHAR(100),
    country_code    CHAR(2),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plots_parcels_farm ON plots.parcels(farm_id);
CREATE INDEX idx_plots_parcels_culture ON plots.parcels(culture_id);
CREATE INDEX idx_plots_parcels_geom ON plots.parcels USING GIST(geom);

-- =========================================================
-- weather.locations — farm-scoped saved locations for the forecast
-- widget. Forecast data is cached inline (forecast_json +
-- forecast_fetched_at) rather than in a separate table: there is only
-- ever one "latest" forecast per location, never a history to query,
-- so a second table would just be a permanent 1:1 join for no benefit.
-- =========================================================
CREATE TABLE weather.locations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id               UUID NOT NULL REFERENCES core.farms(id) ON DELETE CASCADE,
    label                 VARCHAR(200) NOT NULL,
    latitude              DECIMAL(9,6) NOT NULL,
    longitude             DECIMAL(9,6) NOT NULL,
    country_code          CHAR(2),
    timezone              VARCHAR(64),
    forecast_json         JSONB,
    forecast_fetched_at   TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (farm_id, latitude, longitude)
);

CREATE INDEX idx_weather_locations_farm ON weather.locations(farm_id);

-- =========================================================
-- personnel.people — farm staff (permanent or seasonal), deliberately
-- its own entity rather than a role on core.users: most seasonal
-- workers never need or want a login, so an account is optional
-- (user_id nullable, linked at the farm manager's discretion later —
-- no linking flow exists yet, this column just reserves the shape).
-- role_title is free text, not a fixed enum: no agreed taxonomy of farm
-- roles exists yet, and forcing one now would contradict the
-- "rudimentary first" design mandate. status lets someone be archived
-- (left a farm, season ended) without deleting history that future
-- modules (Affectation, Pointage) will want to reference.
-- =========================================================
CREATE TABLE personnel.people (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES core.farms(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES core.users(id) ON DELETE SET NULL,

    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role_title      VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(20),

    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_personnel_people_farm ON personnel.people(farm_id);

-- =========================================================
-- personnel.teams / personnel.team_members — a person can belong to
-- more than one team (e.g. a permanent-staff team and a harvest-season
-- team), same many-to-many shape as core.users_farms.
-- =========================================================
CREATE TABLE personnel.teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id     UUID NOT NULL REFERENCES core.farms(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_personnel_teams_farm ON personnel.teams(farm_id);

CREATE TABLE personnel.team_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES personnel.teams(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES personnel.people(id) ON DELETE CASCADE,
    UNIQUE (team_id, person_id)
);

-- =========================================================
-- Future products plug into this SAME database, e.g.:
--
-- CREATE SCHEMA equipment;
-- CREATE TABLE equipment.machines (
--     id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     farm_id  UUID NOT NULL REFERENCES core.farms(id) ON DELETE CASCADE,
--     ...
-- );
--
-- No change ever needed to core or jobs for this to work, and no
-- new Postgres instance, no new Clever Cloud add-on required.
-- =========================================================
