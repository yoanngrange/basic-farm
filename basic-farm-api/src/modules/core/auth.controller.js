const asyncHandler = require("../../middleware/asyncHandler");
const authService = require("./auth.service");

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  req.log.info({ userId: user.id }, "User registered");
  res.status(201).json({ user });
});

const login = asyncHandler(async (req, res) => {
  const { token, user } = await authService.login(req.body);
  req.log.info({ userId: user.id }, "User logged in");
  res.json({ token, user });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getById(req.user.id);
  res.json({ user });
});

module.exports = { register, login, me };
