const pool = require("../../db/pool");
const { NotFoundError, ValidationError } = require("../../lib/errors");
const farmsService = require("../core/farms.service");
const weatherClient = require("../../lib/weather");
const env = require("../../config/env");

const LOCATION_COLUMNS = `
  id, farm_id, label, latitude, longitude, country_code, timezone,
  forecast_json, forecast_fetched_at, created_at
`;

function isStale(fetchedAt) {
  if (!fetchedAt) return true;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs > env.weatherCacheTtlMinutes * 60 * 1000;
}

// Best-effort: if the refetch fails, keep serving the existing (stale)
// cache rather than turning a degraded forecast into a broken page.
async function refreshRow(row) {
  const forecast = await weatherClient.fetchForecast(row.latitude, row.longitude, row.timezone);
  if (!forecast) return row;
  const result = await pool.query(
    `UPDATE weather.locations SET forecast_json = $1, forecast_fetched_at = now()
     WHERE id = $2 RETURNING ${LOCATION_COLUMNS}`,
    [forecast, row.id]
  );
  return result.rows[0];
}

async function search(query, locale) {
  if (!query || query.trim().length < 2) {
    throw new ValidationError("q must be at least 2 characters");
  }
  return weatherClient.searchLocations(query.trim(), locale);
}

async function listForFarm(farmId) {
  const result = await pool.query(
    `SELECT ${LOCATION_COLUMNS} FROM weather.locations WHERE farm_id = $1 ORDER BY created_at ASC`,
    [farmId]
  );
  // Refresh whatever's stale so "as fresh as possible" doesn't require a
  // manual click — the explicit refresh button below is only for forcing
  // an update sooner than the cache TTL.
  return Promise.all(result.rows.map((row) => (isStale(row.forecast_fetched_at) ? refreshRow(row) : row)));
}

async function listMine(userId, farmId) {
  if (!farmId) throw new ValidationError("farmId is required");
  await farmsService.assertUserCanManage(userId, farmId);
  return listForFarm(farmId);
}

async function create(userId, data) {
  const { farmId, label, latitude, longitude, countryCode, timezone } = data;
  if (!farmId || !label || latitude === undefined || longitude === undefined) {
    throw new ValidationError("farmId, label, latitude and longitude are required");
  }
  await farmsService.assertUserCanManage(userId, farmId);

  const forecast = await weatherClient.fetchForecast(latitude, longitude, timezone);

  const result = await pool.query(
    `INSERT INTO weather.locations (farm_id, label, latitude, longitude, country_code, timezone, forecast_json, forecast_fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, ${forecast ? "now()" : "NULL"})
     ON CONFLICT (farm_id, latitude, longitude) DO UPDATE SET label = EXCLUDED.label
     RETURNING ${LOCATION_COLUMNS}`,
    [farmId, label, latitude, longitude, countryCode || null, timezone || null, forecast]
  );
  return result.rows[0];
}

async function assertUserCanManageLocation(userId, locationId) {
  const result = await pool.query("SELECT farm_id FROM weather.locations WHERE id = $1", [locationId]);
  if (result.rowCount === 0) throw new NotFoundError("Location not found");
  await farmsService.assertUserCanManage(userId, result.rows[0].farm_id);
  return result.rows[0].farm_id;
}

async function remove(userId, locationId) {
  await assertUserCanManageLocation(userId, locationId);
  await pool.query("DELETE FROM weather.locations WHERE id = $1", [locationId]);
}

async function refresh(userId, locationId) {
  await assertUserCanManageLocation(userId, locationId);
  const result = await pool.query(`SELECT ${LOCATION_COLUMNS} FROM weather.locations WHERE id = $1`, [locationId]);
  return refreshRow(result.rows[0]);
}

module.exports = { search, listMine, create, remove, refresh };
