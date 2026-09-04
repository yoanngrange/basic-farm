const asyncHandler = require("../../middleware/asyncHandler");
const apiKeysService = require("./apiKeys.service");

const list = asyncHandler(async (req, res) => {
  const keys = await apiKeysService.list(req.user.id, req.params.farmId);
  res.json({ items: keys });
});

const create = asyncHandler(async (req, res) => {
  const { apiKey, rawKey } = await apiKeysService.create(req.user.id, req.params.farmId, req.body);
  req.log.info({ apiKeyId: apiKey.id, farmId: req.params.farmId }, "API key created");
  res.status(201).json({ apiKey, rawKey });
});

const remove = asyncHandler(async (req, res) => {
  await apiKeysService.remove(req.user.id, req.params.farmId, req.params.keyId);
  res.status(204).send();
});

module.exports = { list, create, remove };
