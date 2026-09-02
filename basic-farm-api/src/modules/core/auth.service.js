const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../db/pool");
const env = require("../../config/env");
const { ValidationError, AuthError, ConflictError } = require("../../lib/errors");

async function register({ email, password, firstName, lastName, phone }) {
  if (!email || !password || !firstName || !lastName) {
    throw new ValidationError("email, password, firstName and lastName are required");
  }
  if (password.length < 8) {
    throw new ValidationError("password must be at least 8 characters long");
  }

  const existing = await pool.query("SELECT id FROM core.users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rowCount > 0) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO core.users (email, password_hash, phone, first_name, last_name, terms_accepted_at)
     VALUES ($1, $2, $3, $4, $5, now())
     RETURNING id, email, first_name, last_name, created_at`,
    [email.toLowerCase(), passwordHash, phone || null, firstName, lastName]
  );
  return result.rows[0];
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new ValidationError("email and password are required");
  }
  const result = await pool.query(
    "SELECT id, email, password_hash, status FROM core.users WHERE email = $1",
    [email.toLowerCase()]
  );
  const user = result.rows[0];
  if (!user) throw new AuthError("Invalid credentials");
  if (user.status !== "active") throw new AuthError("Account is not active");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AuthError("Invalid credentials");

  await pool.query("UPDATE core.users SET last_login_at = now() WHERE id = $1", [user.id]);

  const token = jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
  return { token, user: { id: user.id, email: user.email } };
}

async function getById(userId) {
  const result = await pool.query(
    "SELECT id, email, first_name, last_name, phone, created_at FROM core.users WHERE id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

module.exports = { register, login, getById };
