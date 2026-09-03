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

function squarePolygon(lon, lat, size = 0.001) {
  return {
    type: "Polygon",
    coordinates: [[
      [lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat],
    ]],
  };
}

async function createParcel(token, farmId, overrides = {}) {
  const res = await request(app)
    .post("/api/plots/parcels")
    .set("Authorization", `Bearer ${token}`)
    .send({
      farmId,
      name: overrides.name || "Test parcel",
      geometry: overrides.geometry || squarePolygon(2.3, 48.85),
      cultureId: overrides.cultureId,
    });
  return res.body.parcel;
}

module.exports = { app, registerAndLogin, createFarm, createListing, createParcel, squarePolygon };
