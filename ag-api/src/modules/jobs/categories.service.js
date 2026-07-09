const pool = require("../../db/pool");

async function list(locale = "en") {
  const result = await pool.query(
    `SELECT jc.id, jc.slug AS canonical_slug, jct.locale, jct.label, jct.slug
     FROM jobs.job_categories jc
     JOIN jobs.job_category_translations jct ON jct.category_id = jc.id
     WHERE jct.locale = $1
     ORDER BY jct.label`,
    [locale]
  );
  return result.rows;
}

module.exports = { list };
