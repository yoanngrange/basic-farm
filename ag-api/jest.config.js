module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/loadEnv.js"],
  globalSetup: "<rootDir>/tests/globalSetup.js",
  testTimeout: 15000,
  // Tests share one Postgres database and reset tenant data between
  // tests — running them in parallel would race on that shared state.
  maxWorkers: 1,
};
