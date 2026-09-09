const asyncHandler = require("../../middleware/asyncHandler");
const peopleService = require("./people.service");

const listMine = asyncHandler(async (req, res) => {
  const people = await peopleService.listMine(req.user.id, req.query.farmId);
  res.json({ people });
});

const create = asyncHandler(async (req, res) => {
  const person = await peopleService.create(req.user.id, req.body);
  req.log.info({ personId: person.id, farmId: person.farm_id }, "Person created");
  res.status(201).json({ person });
});

const createBulk = asyncHandler(async (req, res) => {
  const people = await peopleService.createBulk(req.user.id, req.body.farmId, req.body.people);
  req.log.info({ farmId: req.body.farmId, count: people.length }, "People bulk-imported");
  res.status(201).json({ people });
});

const update = asyncHandler(async (req, res) => {
  const person = await peopleService.update(req.user.id, req.params.id, req.body);
  res.json({ person });
});

const remove = asyncHandler(async (req, res) => {
  await peopleService.remove(req.user.id, req.params.id);
  res.status(204).send();
});

module.exports = { listMine, create, createBulk, update, remove };
