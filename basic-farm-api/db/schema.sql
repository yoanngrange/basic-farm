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

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS jobs;

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
