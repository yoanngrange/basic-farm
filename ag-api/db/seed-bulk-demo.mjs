// Bulk demo data generator — creates ~200 farms/farmer accounts and a
// configurable number of listings (default 2000) directly via SQL
// (not the API — at this volume, thousands of sequential HTTP round
// trips would take far too long). Descriptions are lorem ipsum filler;
// titles stay realistic (category-based) so search/listing cards still
// read like a real job board. Deliberately varies status, language,
// category, dates, duration, view_count, and farm completeness to
// exercise every rendering edge case (empty category, no contact info,
// pagination, long/short descriptions, popular vs unseen listings...).
//
// Usage: DATABASE_URL=postgres://... node db/seed-bulk-demo.mjs [count]
// Reuses the exact slug algorithm from src/lib/slug.js so rows are
// indistinguishable from ones the real app would have created.

import pg from "pg";
import bcrypt from "bcryptjs";
import { listingSlug } from "../src/lib/slug.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL env var is required");
const TARGET_LISTINGS = parseInt(process.argv[2] || "2000", 10);
const FARM_COUNT = 200;

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const LOCALES = ["en", "es", "fr", "it", "pt"];
const COUNTRIES = ["FR", "ES", "IT", "PT", "GB", "IE", "DE", "NL", "BE", "PL", "RO", "GR", "HR", "AT", "US"];
const FARM_TYPES = ["crop", "livestock", "mixed", "market_garden", "viticulture", "orchard", "other"];
const DURATION_UNITS = ["day", "week", "month", "season"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDate(daysAgoMin, daysAgoMax) {
  const d = new Date();
  d.setDate(d.getDate() - randInt(daysAgoMin, daysAgoMax));
  return d.toISOString().slice(0, 10);
}

const LOREM_WORDS = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor "
  + "incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud "
  + "exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure "
  + "in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur "
  + "sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim "
  + "id est laborum").split(" ");

function loremSentence(minWords, maxWords) {
  const n = randInt(minWords, maxWords);
  const words = Array.from({ length: n }, () => pick(LOREM_WORDS));
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

function loremParagraphs(count) {
  return Array.from({ length: count }, () => {
    const sentences = randInt(3, 6);
    return Array.from({ length: sentences }, () => loremSentence(6, 14)).join(" ");
  }).join("\n\n");
}

const TITLE_TEMPLATES = {
  en: (cat) => pick([`${cat}`, `${cat} needed`, `${cat} — immediate start`, `Experienced ${cat.toLowerCase()} wanted`, `Seasonal ${cat.toLowerCase()}`]),
  es: (cat) => pick([`${cat}`, `Se busca: ${cat.toLowerCase()}`, `${cat} — incorporación inmediata`, `${cat} de temporada`]),
  fr: (cat) => pick([`${cat}`, `Recherche ${cat.toLowerCase()}`, `${cat} — début immédiat`, `${cat} saisonnier`]),
  it: (cat) => pick([`${cat}`, `Cercasi: ${cat.toLowerCase()}`, `${cat} — inizio immediato`, `${cat} stagionale`]),
  pt: (cat) => pick([`${cat}`, `Procura-se: ${cat.toLowerCase()}`, `${cat} — início imediato`, `${cat} sazonal`]),
};

const FIRST_NAMES = ["Marie", "Jean", "Pierre", "Sophie", "Luc", "Anna", "Marco", "Elena", "Carlos", "Ines",
  "Tom", "Laura", "Hugo", "Julia", "Paul", "Nina", "Leo", "Sara", "Max", "Clara"];
const LAST_NAMES = ["Martin", "Bernard", "Garcia", "Rossi", "Silva", "Dubois", "Moreau", "Fischer", "Kowalski",
  "Novak", "Popescu", "Andersen", "Murphy", "Walsh", "Ferreira", "Lopez", "Costa", "Weber", "Braun", "Klein"];
const FARM_PREFIXES = ["Green", "Sunny", "Golden", "Valley", "Hillside", "Riverside", "Oak", "Meadow", "Willow", "Stone"];
const FARM_SUFFIXES = ["Farm", "Fields", "Orchards", "Estate", "Ranch", "Homestead", "Grounds", "Acres"];

async function main() {
  console.log(`Seeding ${FARM_COUNT} farms and ${TARGET_LISTINGS} listings...`);

  const { rows: catRows } = await pool.query(
    `SELECT jc.id, jc.slug, jct.locale, jct.label
     FROM jobs.job_categories jc JOIN jobs.job_category_translations jct ON jct.category_id = jc.id`
  );
  const categories = {};
  for (const row of catRows) {
    categories[row.slug] = categories[row.slug] || { id: row.id, labels: {} };
    categories[row.slug].labels[row.locale] = row.label;
  }
  const categorySlugs = Object.keys(categories);
  if (categorySlugs.length === 0) throw new Error("No categories found — run seed-categories.sql first");

  const dummyHash = await bcrypt.hash("BulkDemoFarmer2026!", 12);
  const runId = Date.now().toString(36);

  // --- Users + farms -----------------------------------------------
  const userRows = [];
  const farmRows = [];
  for (let i = 0; i < FARM_COUNT; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    userRows.push([`${first.toLowerCase()}.${last.toLowerCase()}.${runId}.${i}@example.com`, dummyHash, first, last]);

    const hasLogo = Math.random() < 0.3;
    const hasContact = Math.random() < 0.8; // ~20% deliberately incomplete — reveal-contact "no info" edge case
    farmRows.push([
      `${pick(FARM_PREFIXES)} ${pick(FARM_SUFFIXES)}`,
      pick(COUNTRIES),
      pick(FARM_TYPES),
      hasLogo ? `https://picsum.photos/seed/${runId}${i}/200/200` : null,
      hasContact ? `contact${i}.${runId}@example.com` : null,
      hasContact ? `+${randInt(1, 99)} ${randInt(100000000, 999999999)}` : null,
    ]);
  }

  const client = await pool.connect();
  try {
    const userIds = [];
    for (const [email, hash, first, last] of userRows) {
      const { rows } = await client.query(
        `INSERT INTO core.users (email, password_hash, first_name, last_name, terms_accepted_at)
         VALUES ($1,$2,$3,$4, now()) RETURNING id`,
        [email, hash, first, last]
      );
      userIds.push(rows[0].id);
    }
    console.log(`  + ${userIds.length} farmer accounts`);

    const farmIds = [];
    for (let i = 0; i < farmRows.length; i++) {
      const [name, country, farmType, logoUrl, contactEmail, contactPhone] = farmRows[i];
      const { rows } = await client.query(
        `INSERT INTO core.farms (name, country_code, farm_type, logo_url, contact_email, contact_phone)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [name, country, farmType, logoUrl, contactEmail, contactPhone]
      );
      farmIds.push(rows[0].id);
      await client.query(
        `INSERT INTO core.users_farms (user_id, farm_id, role) VALUES ($1,$2,'owner')`,
        [userIds[i], farmIds[i]]
      );
    }
    console.log(`  + ${farmIds.length} farms`);

    // Heavy-tailed weight per farm: mostly a handful of listings, a few prolific ones.
    const farmPool = [];
    farmIds.forEach((id, i) => {
      const weight = Math.ceil(Math.pow(Math.random(), 2) * 15) + 1;
      for (let w = 0; w < weight; w++) farmPool.push({ farmId: id, userId: userIds[i] });
    });

    // --- Listings, batched -------------------------------------------
    const BATCH_SIZE = 250;
    let created = 0;
    while (created < TARGET_LISTINGS) {
      const batchCount = Math.min(BATCH_SIZE, TARGET_LISTINGS - created);
      const values = [];
      const params = [];
      let p = 1;

      for (let i = 0; i < batchCount; i++) {
        const { farmId, userId } = pick(farmPool);
        const locale = pick(LOCALES);
        const hasCategory = Math.random() > 0.05; // ~5% no category — edge case
        const categorySlug = hasCategory ? pick(categorySlugs) : null;
        const categoryId = hasCategory ? categories[categorySlug].id : null;
        const catLabel = hasCategory ? categories[categorySlug].labels[locale] || categories[categorySlug].labels.en : "Farm work";
        const title = TITLE_TEMPLATES[locale](catLabel);

        const descLen = Math.random();
        const description = descLen < 0.2 ? loremParagraphs(1) : descLen < 0.8 ? loremParagraphs(randInt(2, 3)) : loremParagraphs(randInt(4, 6));

        const statusRoll = Math.random();
        let status, publishedAt, expiresAt;
        if (statusRoll < 0.55) {
          status = "published"; publishedAt = randDate(0, 540); expiresAt = Math.random() < 0.5 ? randDate(-180, 0) : null;
        } else if (statusRoll < 0.70) {
          status = "draft"; publishedAt = null; expiresAt = null;
        } else if (statusRoll < 0.80) {
          status = "filled"; publishedAt = randDate(30, 540);
          expiresAt = Math.random() < 0.5 ? randDate(-90, 0) : null;
        } else if (statusRoll < 0.90) {
          status = "expired"; publishedAt = randDate(60, 540); expiresAt = randDate(1, 180);
        } else {
          status = "archived"; publishedAt = randDate(180, 700); expiresAt = randDate(1, 400);
        }

        const hasStartDate = Math.random() < 0.6;
        const startDate = hasStartDate ? randDate(-120, 200) : null;
        const hasDuration = Math.random() < 0.7;
        const durationValue = hasDuration ? randInt(1, 12) : null;
        const durationUnit = hasDuration ? pick(DURATION_UNITS) : null;

        const viewRoll = Math.random();
        const viewCount = viewRoll < 0.8 ? randInt(0, 50) : viewRoll < 0.95 ? randInt(50, 300) : randInt(300, 2000);

        // Distinct placeholder slug per row (multi-row insert, so a literal
        // 'TEMP' would collide with the UNIQUE constraint) — overwritten
        // with the real id-embedding slug right after via the batched UPDATE.
        values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},gen_random_uuid()::text,$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
        params.push(farmId, userId, categoryId, title, description, locale, publishedAt, startDate, durationValue, durationUnit, status, expiresAt, viewCount);
      }

      const { rows } = await client.query(
        `INSERT INTO jobs.job_listings
           (farm_id, user_id, category_id, title, description, slug, language, published_at, start_date, duration_value, duration_unit, status, expires_at, view_count)
         VALUES ${values.join(",")}
         RETURNING id, title`,
        params
      );

      const updateValues = [];
      const updateParams = [];
      let up = 1;
      for (const row of rows) {
        const slug = listingSlug(row.id, row.title);
        updateValues.push(`($${up++}::uuid,$${up++}::text)`);
        updateParams.push(row.id, slug);
      }
      await client.query(
        `UPDATE jobs.job_listings AS l SET slug = v.slug FROM (VALUES ${updateValues.join(",")}) AS v(id, slug) WHERE l.id = v.id`,
        updateParams
      );

      created += batchCount;
      console.log(`  + ${created}/${TARGET_LISTINGS} listings`);
    }
  } finally {
    client.release();
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
