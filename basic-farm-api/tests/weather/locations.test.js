const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

beforeEach(resetTenantData);
afterAll(() => pool.end());

describe("GET /api/weather/locations/search", () => {
  it("returns geocoding candidates (stubbed in test env)", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .get("/api/weather/locations/search?q=Paris")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0]).toHaveProperty("latitude");
    expect(res.body.results[0]).toHaveProperty("longitude");
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/weather/locations/search?q=Paris");
    expect(res.status).toBe(401);
  });

  it("rejects a query shorter than 2 characters", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .get("/api/weather/locations/search?q=a")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/weather/locations", () => {
  it("saves a location with a forecast fetched immediately (stubbed in test env)", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/weather/locations")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, label: "Paris, France", latitude: 48.85, longitude: 2.35, countryCode: "FR", timezone: "Europe/Paris" });

    expect(res.status).toBe(201);
    expect(res.body.location.label).toBe("Paris, France");
    expect(res.body.location.forecast_json).toBeTruthy();
    expect(res.body.location.forecast_fetched_at).toBeTruthy();
  });

  it("rejects a location without farmId, label, or coordinates", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/weather/locations")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, label: "No coords" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when the user does not manage the farm", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const res = await request(app)
      .post("/api/weather/locations")
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ farmId: farm.id, label: "Hijack", latitude: 0, longitude: 0 });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/weather/locations/mine", () => {
  it("only returns locations belonging to the requested farm", async () => {
    const { token } = await registerAndLogin();
    const farmA = await createFarm(token, { name: "Farm A" });
    const farmB = await createFarm(token, { name: "Farm B" });
    await request(app)
      .post("/api/weather/locations")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farmA.id, label: "A", latitude: 1, longitude: 1 });
    await request(app)
      .post("/api/weather/locations")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farmB.id, label: "B", latitude: 2, longitude: 2 });

    const res = await request(app)
      .get(`/api/weather/locations/mine?farmId=${farmA.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(1);
    expect(res.body.locations[0].label).toBe("A");
  });

  it("requires farmId", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get("/api/weather/locations/mine").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/weather/locations/:id/refresh", () => {
  it("refetches the forecast and bumps forecast_fetched_at", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const created = await request(app)
      .post("/api/weather/locations")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, label: "Test", latitude: 1, longitude: 1 });

    const res = await request(app)
      .post(`/api/weather/locations/${created.body.location.id}/refresh`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.location.forecast_fetched_at).toBeTruthy();
  });

  it("returns 403 for a farm the user doesn't manage", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const created = await request(app)
      .post("/api/weather/locations")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ farmId: farm.id, label: "Test", latitude: 1, longitude: 1 });

    const res = await request(app)
      .post(`/api/weather/locations/${created.body.location.id}/refresh`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/weather/locations/:id", () => {
  it("deletes a location the user manages", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const created = await request(app)
      .post("/api/weather/locations")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, label: "Test", latitude: 1, longitude: 1 });

    const res = await request(app)
      .delete(`/api/weather/locations/${created.body.location.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app)
      .get(`/api/weather/locations/mine?farmId=${farm.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.locations).toHaveLength(0);
  });
});
