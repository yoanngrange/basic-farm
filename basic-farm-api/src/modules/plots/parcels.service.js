const pool = require("../../db/pool");
const { NotFoundError, ValidationError } = require("../../lib/errors");
const { reverseGeocode, approximateCentroid } = require("../../lib/geocode");
const farmsService = require("../core/farms.service");

const PARCEL_COLUMNS = `
  id, farm_id, culture_id, name,
  ST_AsGeoJSON(geom::geometry) AS geometry,
  area_ha, locality, country_code, created_at, updated_at
`;

function validateGeometry(geometry) {
  if (!geometry || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
    throw new ValidationError("geometry must be a GeoJSON Polygon");
  }
}

function parseRow(row) {
  return { ...row, geometry: JSON.parse(row.geometry) };
}

async function create(userId, data) {
  const { farmId, name, geometry, cultureId } = data;
  if (!farmId || !name) throw new ValidationError("farmId and name are required");
  validateGeometry(geometry);
  await farmsService.assertUserCanManage(userId, farmId);

  // Best-effort — never blocks parcel creation if the geocoder is slow/down.
  const { lat, lon } = approximateCentroid(geometry);
  const { locality, countryCode } = await reverseGeocode(lat, lon);

  const result = await pool.query(
    `INSERT INTO plots.parcels (farm_id, culture_id, name, geom, locality, country_code)
     VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4)::geography, $5, $6)
     RETURNING ${PARCEL_COLUMNS}`,
    [farmId, cultureId || null, name, JSON.stringify(geometry), locality, countryCode]
  );
  return parseRow(result.rows[0]);
}

async function listMine(userId, farmId) {
  if (!farmId) throw new ValidationError("farmId is required");
  await farmsService.assertUserCanManage(userId, farmId);
  const result = await pool.query(
    `SELECT p.id, p.farm_id, p.culture_id, c.slug AS culture_slug, p.name,
            ST_AsGeoJSON(p.geom::geometry) AS geometry, p.area_ha, p.locality, p.country_code,
            p.created_at, p.updated_at
     FROM plots.parcels p
     LEFT JOIN plots.cultures c ON c.id = p.culture_id
     WHERE p.farm_id = $1
     ORDER BY p.created_at DESC`,
    [farmId]
  );
  return result.rows.map(parseRow);
}

async function assertUserCanManageParcel(userId, parcelId) {
  const result = await pool.query("SELECT farm_id FROM plots.parcels WHERE id = $1", [parcelId]);
  if (result.rowCount === 0) throw new NotFoundError("Parcel not found");
  await farmsService.assertUserCanManage(userId, result.rows[0].farm_id);
  return result.rows[0].farm_id;
}

async function update(userId, parcelId, data) {
  await assertUserCanManageParcel(userId, parcelId);
  const { name, geometry, cultureId } = data;

  const sets = [];
  const values = [];
  let i = 1;
  if (name !== undefined) { sets.push(`name = $${i}`); values.push(name); i++; }
  if (cultureId !== undefined) { sets.push(`culture_id = $${i}`); values.push(cultureId); i++; }
  if (geometry !== undefined) {
    validateGeometry(geometry);
    sets.push(`geom = ST_GeomFromGeoJSON($${i})::geography`);
    values.push(JSON.stringify(geometry));
    i++;
    const { lat, lon } = approximateCentroid(geometry);
    const { locality, countryCode } = await reverseGeocode(lat, lon);
    sets.push(`locality = $${i}`); values.push(locality); i++;
    sets.push(`country_code = $${i}`); values.push(countryCode); i++;
  }
  if (sets.length === 0) throw new ValidationError("No updatable fields provided");
  sets.push("updated_at = now()");
  values.push(parcelId);

  const result = await pool.query(
    `UPDATE plots.parcels SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${PARCEL_COLUMNS}`,
    values
  );
  return parseRow(result.rows[0]);
}

async function remove(userId, parcelId) {
  await assertUserCanManageParcel(userId, parcelId);
  await pool.query("DELETE FROM plots.parcels WHERE id = $1", [parcelId]);
}

module.exports = { create, listMine, update, remove };
