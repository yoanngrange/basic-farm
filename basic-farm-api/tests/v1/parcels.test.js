const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm, createParcel, createApiKey } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

beforeEach(resetTenantData);
afterAll(() => pool.end());

describe("GET /api/v1/parcels", () => {
  it("returns only the key's own farm's parcels, no farmId param involved", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    await createParcel(token, farm.id, { name: "Champ 1" });
    const { rawKey } = await createApiKey(token, farm.id);

    const res = await request(app).get("/api/v1/parcels").set("Authorization", `Bearer ${rawKey}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe("Champ 1");
  });

  it("rejects requests with no API key", async () => {
    const res = await request(app).get("/api/v1/parcels");
    expect(res.status).toBe(401);
  });

  it("rejects an unknown API key", async () => {
    const res = await request(app).get("/api/v1/parcels").set("Authorization", "Bearer bf_doesnotexist");
    expect(res.status).toBe(401);
  });

  it("never leaks another farm's parcels", async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const ownerFarm = await createFarm(owner.token, { name: "Owner farm" });
    const otherFarm = await createFarm(other.token, { name: "Other farm" });
    await createParcel(owner.token, ownerFarm.id, { name: "Owner parcel" });
    await createParcel(other.token, otherFarm.id, { name: "Other parcel" });
    const { rawKey } = await createApiKey(owner.token, ownerFarm.id);

    const res = await request(app).get("/api/v1/parcels").set("Authorization", `Bearer ${rawKey}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe("Owner parcel");
  });
});

describe("GET /api/v1/parcels/:id", () => {
  it("returns a single parcel belonging to the key's farm", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const parcel = await createParcel(token, farm.id);
    const { rawKey } = await createApiKey(token, farm.id);

    const res = await request(app).get(`/api/v1/parcels/${parcel.id}`).set("Authorization", `Bearer ${rawKey}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(parcel.id);
  });

  it("returns 404 for a parcel belonging to a different farm (never leaks existence)", async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const ownerFarm = await createFarm(owner.token, { name: "Owner farm" });
    const otherFarm = await createFarm(other.token, { name: "Other farm" });
    const otherParcel = await createParcel(other.token, otherFarm.id);
    const { rawKey } = await createApiKey(owner.token, ownerFarm.id);

    const res = await request(app).get(`/api/v1/parcels/${otherParcel.id}`).set("Authorization", `Bearer ${rawKey}`);
    expect(res.status).toBe(404);
  });
});
