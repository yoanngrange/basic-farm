const pool = require("../../db/pool");
const { NotFoundError, ValidationError } = require("../../lib/errors");
const farmsService = require("../core/farms.service");

const PERSON_COLUMNS = `
  id, farm_id, user_id, first_name, last_name, role_title, email, phone, status, created_at
`;

async function listForFarm(farmId) {
  const result = await pool.query(
    `SELECT ${PERSON_COLUMNS} FROM personnel.people WHERE farm_id = $1 ORDER BY last_name, first_name`,
    [farmId]
  );
  return result.rows;
}

async function listMine(userId, farmId) {
  if (!farmId) throw new ValidationError("farmId is required");
  await farmsService.assertUserCanManage(userId, farmId);
  return listForFarm(farmId);
}

function validatePerson({ firstName, lastName }) {
  if (!firstName || !lastName) {
    throw new ValidationError("firstName and lastName are required");
  }
}

async function create(userId, data) {
  const { farmId, firstName, lastName, roleTitle, email, phone } = data;
  if (!farmId) throw new ValidationError("farmId is required");
  validatePerson(data);
  await farmsService.assertUserCanManage(userId, farmId);

  const result = await pool.query(
    `INSERT INTO personnel.people (farm_id, first_name, last_name, role_title, email, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${PERSON_COLUMNS}`,
    [farmId, firstName, lastName, roleTitle || null, email || null, phone || null]
  );
  return result.rows[0];
}

// Lightweight bulk "import": a farmer pastes one person per line rather
// than uploading a file — no CSV/file-format parsing needed for a first
// pass. Each row still runs through the same validation as a single
// create; a bad row anywhere fails the whole batch (transactional) so
// the farmer isn't left with a half-imported list to clean up by hand.
async function createBulk(userId, farmId, people) {
  if (!farmId) throw new ValidationError("farmId is required");
  if (!Array.isArray(people) || people.length === 0) {
    throw new ValidationError("people must be a non-empty array");
  }
  people.forEach(validatePerson);
  await farmsService.assertUserCanManage(userId, farmId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = [];
    for (const person of people) {
      const result = await client.query(
        `INSERT INTO personnel.people (farm_id, first_name, last_name, role_title, email, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${PERSON_COLUMNS}`,
        [farmId, person.firstName, person.lastName, person.roleTitle || null, person.email || null, person.phone || null]
      );
      created.push(result.rows[0]);
    }
    await client.query("COMMIT");
    return created;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function assertUserCanManagePerson(userId, personId) {
  const result = await pool.query("SELECT farm_id FROM personnel.people WHERE id = $1", [personId]);
  if (result.rowCount === 0) throw new NotFoundError("Person not found");
  await farmsService.assertUserCanManage(userId, result.rows[0].farm_id);
  return result.rows[0].farm_id;
}

async function update(userId, personId, data) {
  await assertUserCanManagePerson(userId, personId);
  const { firstName, lastName, roleTitle, email, phone, status } = data;

  const sets = [];
  const values = [];
  let i = 1;
  if (firstName !== undefined) { sets.push(`first_name = $${i}`); values.push(firstName); i++; }
  if (lastName !== undefined) { sets.push(`last_name = $${i}`); values.push(lastName); i++; }
  if (roleTitle !== undefined) { sets.push(`role_title = $${i}`); values.push(roleTitle); i++; }
  if (email !== undefined) { sets.push(`email = $${i}`); values.push(email); i++; }
  if (phone !== undefined) { sets.push(`phone = $${i}`); values.push(phone); i++; }
  if (status !== undefined) {
    if (!["active", "inactive"].includes(status)) throw new ValidationError("Invalid status");
    sets.push(`status = $${i}`); values.push(status); i++;
  }
  if (sets.length === 0) throw new ValidationError("No updatable fields provided");
  values.push(personId);

  const result = await pool.query(
    `UPDATE personnel.people SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${PERSON_COLUMNS}`,
    values
  );
  return result.rows[0];
}

async function remove(userId, personId) {
  await assertUserCanManagePerson(userId, personId);
  await pool.query("DELETE FROM personnel.people WHERE id = $1", [personId]);
}

module.exports = { listMine, create, createBulk, update, remove, assertUserCanManagePerson };
