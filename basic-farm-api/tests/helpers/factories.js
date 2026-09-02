const request = require("supertest");
const app = require("../../src/app");

let counter = 0;
function uniqueEmail() {
  counter += 1;
  return `user${Date.now()}${counter}@basicfarm-tests.example`;
}

async function registerAndLogin(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || "supersecret123";
  await request(app).post("/api/core/auth/register").send({
    email,
    password,
    firstName: overrides.firstName || "Test",
    lastName: overrides.lastName || "User",
  });
  const loginRes = await request(app).post("/api/core/auth/login").send({ email, password });
  return { token: loginRes.body.token, user: loginRes.body.user, email, password };
}

async function createFarm(token, overrides = {}) {
  const res = await request(app)
    .post("/api/core/farms")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: overrides.name || "Test Farm",
      countryCode: overrides.countryCode || "FR",
      farmType: overrides.farmType || "mixed",
      locality: overrides.locality || "Nantes",
      region: overrides.region || "Pays de la Loire",
    });
  return res.body.farm;
}

async function createListing(token, farmId, overrides = {}) {
  const res = await request(app)
    .post("/api/jobs/listings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      farmId,
      title: overrides.title || "Test listing",
      description: overrides.description || "A test listing description, plain text only.",
      language: overrides.language || "fr",
      categoryId: overrides.categoryId,
    });
  return res.body.listing;
}

module.exports = { app, registerAndLogin, createFarm, createListing };
