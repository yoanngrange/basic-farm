const pool = require("../../db/pool");

async function list(locale = "en") {
  const result = await pool.query(
    `SELECT c.id, c.slug AS canonical_slug, ct.locale, ct.label, ct.slug
     FROM plots.cultures c
     JOIN plots.culture_translations ct ON ct.culture_id = c.id
     WHERE ct.locale = $1
     ORDER BY ct.label`,
    [locale]
  );
  return result.rows;
}

module.exports = { list };
