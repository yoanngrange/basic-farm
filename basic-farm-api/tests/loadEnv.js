// Runs before the test framework and before any test file requires
// the app — this must set env vars before src/config/env.js is ever
// evaluated, since it throws on missing required vars.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.test") });
