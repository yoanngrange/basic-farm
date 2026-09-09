const asyncHandler = require("../../middleware/asyncHandler");
const teamsService = require("./teams.service");

const listMine = asyncHandler(async (req, res) => {
  const teams = await teamsService.listMine(req.user.id, req.query.farmId);
  res.json({ teams });
});

const create = asyncHandler(async (req, res) => {
  const team = await teamsService.create(req.user.id, req.body);
  req.log.info({ teamId: team.id, farmId: team.farm_id }, "Team created");
  res.status(201).json({ team });
});

const update = asyncHandler(async (req, res) => {
  const team = await teamsService.update(req.user.id, req.params.id, req.body);
  res.json({ team });
});

const remove = asyncHandler(async (req, res) => {
  await teamsService.remove(req.user.id, req.params.id);
  res.status(204).send();
});

const addMember = asyncHandler(async (req, res) => {
  const team = await teamsService.addMember(req.user.id, req.params.id, req.body.personId);
  res.status(201).json({ team });
});

const removeMember = asyncHandler(async (req, res) => {
  const team = await teamsService.removeMember(req.user.id, req.params.id, req.params.personId);
  res.json({ team });
});

module.exports = { listMine, create, update, remove, addMember, removeMember };
