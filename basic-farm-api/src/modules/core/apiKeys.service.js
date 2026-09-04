const pool = require("../../db/pool");
const { ValidationError, NotFoundError } = require("../../lib/errors");
const { generateApiKey, hashToken } = require("../../lib/tokens");
const farmsService = require("./farms.service");

const MAX_API_KEYS_PER_FARM = 20;

const SUMMARY_COLUMNS = `
  k.id, k.name, k.scope, k.key_preview, k.last_used_at, k.created_at,
  u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.email AS created_by_email
`;

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    key_preview: row.key_preview,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    created_by: row.created_by_email
      ? { first_name: row.created_by_first_name, last_name: row.created_by_last_name, email: row.created_by_email }
      : null,
  };
}

async function list(userId, farmId) {
  await farmsService.assertUserCanManage(userId, farmId);
  const result = await pool.query(
    `SELECT ${SUMMARY_COLUMNS}
     FROM core.api_keys k
     LEFT JOIN core.users u ON u.id = k.created_by
     WHERE k.farm_id = $1
     ORDER BY k.created_at DESC`,
    [farmId]
  );
  return result.rows.map(serialize);
}

async function create(userId, farmId, data) {
  await farmsService.assertUserCanManage(userId, farmId);
  const { name, scope = "read" } = data;
  if (!name || !name.trim()) throw new ValidationError("name is required");
  if (!["read", "read_write"].includes(scope)) throw new ValidationError("scope must be read or read_write");

  const count = await pool.query("SELECT count(*) FROM core.api_keys WHERE farm_id = $1", [farmId]);
  if (parseInt(count.rows[0].count, 10) >= MAX_API_KEYS_PER_FARM) {
    throw new ValidationError(`Maximum of ${MAX_API_KEYS_PER_FARM} API keys reached for this farm`);
  }

  const rawKey = generateApiKey();
  const inserted = await pool.query(
    `INSERT INTO core.api_keys (farm_id, created_by, name, scope, key_hash, key_preview)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [farmId, userId, name.trim(), scope, hashToken(rawKey), rawKey.slice(-6)]
  );
  const result = await pool.query(
    `SELECT ${SUMMARY_COLUMNS} FROM core.api_keys k LEFT JOIN core.users u ON u.id = k.created_by WHERE k.id = $1`,
    [inserted.rows[0].id]
  );
  // rawKey is only ever returned here, at creation time — every other
  // read (list) only ever exposes key_preview.
  return { apiKey: serialize(result.rows[0]), rawKey };
}

async function remove(userId, farmId, keyId) {
  await farmsService.assertUserCanManage(userId, farmId);
  const result = await pool.query("DELETE FROM core.api_keys WHERE id = $1 AND farm_id = $2", [keyId, farmId]);
  if (result.rowCount === 0) throw new NotFoundError("API key not found");
}

module.exports = { list, create, remove };
