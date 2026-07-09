const pool = require("../../src/db/pool");

// Wipes every tenant-owned row between tests, but leaves the fixture
// job_categories / job_category_translations rows from globalSetup
// alone — those are read-only reference data shared by every test.
async function resetTenantData() {
  await pool.query("DELETE FROM jobs.listing_contacts");
  await pool.query("DELETE FROM jobs.job_listings");
  await pool.query("DELETE FROM core.users_farms");
  await pool.query("DELETE FROM core.farms");
  await pool.query("DELETE FROM core.users");
}

module.exports = { resetTenantData };
