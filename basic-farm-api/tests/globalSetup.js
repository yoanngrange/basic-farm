// Runs once before the whole test run, in its own process (no access
// to setupFiles), so env loading happens again here independently.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.test") });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

module.exports = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query("DROP SCHEMA IF EXISTS jobs CASCADE");
  await client.query("DROP SCHEMA IF EXISTS core CASCADE");

  const schemaSql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  await client.query(schemaSql);

  // Fixed-id fixture categories, reused (read-only) by every test file —
  // not touched by the per-test reset helper.
  await client.query(`
    INSERT INTO jobs.job_categories (id, label, slug) VALUES
      ('11111111-1111-1111-1111-111111111111', 'Grape Harvest', 'grape-harvest'),
      ('22222222-2222-2222-2222-222222222222', 'Apple Picking', 'apple-picking');

    INSERT INTO jobs.job_category_translations (category_id, locale, label, slug) VALUES
      ('11111111-1111-1111-1111-111111111111', 'en', 'Grape Harvest', 'grape-harvest'),
      ('11111111-1111-1111-1111-111111111111', 'fr', 'Vendange', 'vendange'),
      ('11111111-1111-1111-1111-111111111111', 'it', 'Vendemmia', 'vendemmia'),
      ('22222222-2222-2222-2222-222222222222', 'en', 'Apple Picking', 'apple-picking'),
      ('22222222-2222-2222-2222-222222222222', 'fr', 'Cueillette de pommes', 'cueillette-de-pommes');
  `);

  await client.end();
};
