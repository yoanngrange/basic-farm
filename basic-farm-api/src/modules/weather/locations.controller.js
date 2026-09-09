const asyncHandler = require("../../middleware/asyncHandler");
const locationsService = require("./locations.service");

const search = asyncHandler(async (req, res) => {
  const results = await locationsService.search(req.query.q, req.query.locale);
  res.json({ results });
});

const listMine = asyncHandler(async (req, res) => {
  const locations = await locationsService.listMine(req.user.id, req.query.farmId);
  res.json({ locations });
});

const create = asyncHandler(async (req, res) => {
  const location = await locationsService.create(req.user.id, req.body);
  req.log.info({ locationId: location.id, farmId: location.farm_id }, "Weather location created");
  res.status(201).json({ location });
});

const remove = asyncHandler(async (req, res) => {
  await locationsService.remove(req.user.id, req.params.id);
  res.status(204).send();
});

const refresh = asyncHandler(async (req, res) => {
  const location = await locationsService.refresh(req.user.id, req.params.id);
  res.json({ location });
});

module.exports = { search, listMine, create, remove, refresh };
