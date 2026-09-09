const pool = require("../../db/pool");
const { NotFoundError, ValidationError, ConflictError } = require("../../lib/errors");
const farmsService = require("../core/farms.service");

async function attachMembers(teams) {
  if (teams.length === 0) return teams;
  const result = await pool.query(
    `SELECT tm.team_id, p.id, p.first_name, p.last_name, p.role_title
     FROM personnel.team_members tm
     JOIN personnel.people p ON p.id = tm.person_id
     WHERE tm.team_id = ANY($1)
     ORDER BY p.last_name, p.first_name`,
    [teams.map((t) => t.id)]
  );
  const membersByTeam = new Map();
  result.rows.forEach((row) => {
    const list = membersByTeam.get(row.team_id) || [];
    list.push({ id: row.id, first_name: row.first_name, last_name: row.last_name, role_title: row.role_title });
    membersByTeam.set(row.team_id, list);
  });
  return teams.map((team) => ({ ...team, members: membersByTeam.get(team.id) || [] }));
}

async function listForFarm(farmId) {
  const result = await pool.query(
    `SELECT id, farm_id, name, created_at FROM personnel.teams WHERE farm_id = $1 ORDER BY name`,
    [farmId]
  );
  return attachMembers(result.rows);
}

async function listMine(userId, farmId) {
  if (!farmId) throw new ValidationError("farmId is required");
  await farmsService.assertUserCanManage(userId, farmId);
  return listForFarm(farmId);
}

async function create(userId, data) {
  const { farmId, name } = data;
  if (!farmId || !name) throw new ValidationError("farmId and name are required");
  await farmsService.assertUserCanManage(userId, farmId);

  const result = await pool.query(
    `INSERT INTO personnel.teams (farm_id, name) VALUES ($1, $2) RETURNING id, farm_id, name, created_at`,
    [farmId, name]
  );
  return { ...result.rows[0], members: [] };
}

async function assertUserCanManageTeam(userId, teamId) {
  const result = await pool.query("SELECT farm_id FROM personnel.teams WHERE id = $1", [teamId]);
  if (result.rowCount === 0) throw new NotFoundError("Team not found");
  await farmsService.assertUserCanManage(userId, result.rows[0].farm_id);
  return result.rows[0].farm_id;
}

async function update(userId, teamId, data) {
  const farmId = await assertUserCanManageTeam(userId, teamId);
  const { name } = data;
  if (!name) throw new ValidationError("name is required");

  const result = await pool.query(
    `UPDATE personnel.teams SET name = $1 WHERE id = $2 RETURNING id, farm_id, name, created_at`,
    [name, teamId]
  );
  const [team] = await attachMembers([result.rows[0]]);
  return team;
}

async function remove(userId, teamId) {
  await assertUserCanManageTeam(userId, teamId);
  await pool.query("DELETE FROM personnel.teams WHERE id = $1", [teamId]);
}

async function addMember(userId, teamId, personId) {
  if (!personId) throw new ValidationError("personId is required");
  const farmId = await assertUserCanManageTeam(userId, teamId);

  const person = await pool.query("SELECT farm_id FROM personnel.people WHERE id = $1", [personId]);
  if (person.rowCount === 0) throw new NotFoundError("Person not found");
  if (person.rows[0].farm_id !== farmId) throw new NotFoundError("Person not found");

  try {
    await pool.query(
      `INSERT INTO personnel.team_members (team_id, person_id) VALUES ($1, $2)`,
      [teamId, personId]
    );
  } catch (e) {
    if (e.code === "23505") throw new ConflictError("Person is already a member of this team");
    throw e;
  }
  return getTeam(teamId);
}

async function getTeam(teamId) {
  const result = await pool.query(
    "SELECT id, farm_id, name, created_at FROM personnel.teams WHERE id = $1",
    [teamId]
  );
  const [team] = await attachMembers(result.rows);
  return team;
}

async function removeMember(userId, teamId, personId) {
  await assertUserCanManageTeam(userId, teamId);
  await pool.query(
    "DELETE FROM personnel.team_members WHERE team_id = $1 AND person_id = $2",
    [teamId, personId]
  );
  return getTeam(teamId);
}

module.exports = { listMine, create, update, remove, addMember, removeMember };
