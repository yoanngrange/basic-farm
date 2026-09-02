const pool = require("../../db/pool");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../lib/errors");

async function createFarm(userId, data) {
  const { name, countryCode, farmType, addressLine, postalCode, locality, region, latitude, longitude, website, description, contactEmail, contactPhone, logoUrl } = data;
  if (!name || !countryCode) {
    throw new ValidationError("name and countryCode are required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const farmResult = await client.query(
      `INSERT INTO core.farms (name, country_code, farm_type, address_line, postal_code, locality, region, latitude, longitude, website, description, contact_email, contact_phone, logo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [name, countryCode.toUpperCase(), farmType || null, addressLine || null, postalCode || null, locality || null, region || null, latitude || null, longitude || null, website || null, description || null, contactEmail || null, contactPhone || null, logoUrl || null]
    );
    const farm = farmResult.rows[0];
    await client.query(
      `INSERT INTO core.users_farms (user_id, farm_id, role) VALUES ($1, $2, 'owner')`,
      [userId, farm.id]
    );
    await client.query("COMMIT");
    return farm;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function listMine(userId) {
  const result = await pool.query(
    `SELECT f.*, uf.role FROM core.farms f
     JOIN core.users_farms uf ON uf.farm_id = f.id
     WHERE uf.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function assertUserCanManage(userId, farmId) {
  const result = await pool.query(
    "SELECT role FROM core.users_farms WHERE user_id = $1 AND farm_id = $2",
    [userId, farmId]
  );
  if (result.rowCount === 0) {
    throw new ForbiddenError("You do not have access to this farm");
  }
  return result.rows[0].role;
}

async function updateFarm(userId, farmId, data) {
  await assertUserCanManage(userId, farmId);
  const fields = ["name", "farm_type", "address_line", "postal_code", "locality", "region", "latitude", "longitude", "website", "description", "contact_email", "contact_phone", "logo_url"];
  const map = { farm_type: "farmType", address_line: "addressLine", postal_code: "postalCode", contact_email: "contactEmail", contact_phone: "contactPhone", logo_url: "logoUrl" };
  const sets = [];
  const values = [];
  let i = 1;
  for (const col of fields) {
    const key = map[col] || col;
    if (data[key] !== undefined) {
      sets.push(`${col} = $${i}`);
      values.push(data[key]);
      i++;
    }
  }
  if (sets.length === 0) throw new ValidationError("No updatable fields provided");
  values.push(farmId);
  const result = await pool.query(
    `UPDATE core.farms SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  if (result.rowCount === 0) throw new NotFoundError("Farm not found");
  return result.rows[0];
}

async function getPublicById(farmId) {
  const result = await pool.query(
    `SELECT id, name, country_code, farm_type, address_line, locality, region, website, logo_url, description, created_at
     FROM core.farms WHERE id = $1`,
    [farmId]
  );
  if (result.rowCount === 0) throw new NotFoundError("Farm not found");
  return result.rows[0];
}

module.exports = { createFarm, listMine, updateFarm, assertUserCanManage, getPublicById };
