const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm, createParcel, squarePolygon } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

const WHEAT_ID = "33333333-3333-3333-3333-333333333333";

beforeEach(resetTenantData);
afterAll(() => pool.end());

describe("POST /api/plots/parcels", () => {
  it("creates a parcel with a computed area and geocoded locality/country", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/plots/parcels")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, name: "Grand champ", cultureId: WHEAT_ID, geometry: squarePolygon(2.3, 48.85) });

    expect(res.status).toBe(201);
    expect(res.body.parcel.name).toBe("Grand champ");
    expect(res.body.parcel.culture_id).toBe(WHEAT_ID);
    expect(parseFloat(res.body.parcel.area_ha)).toBeGreaterThan(0);
    // geocoding is stubbed in NODE_ENV=test — see src/lib/geocode.js
    expect(res.body.parcel.locality).toBe("Test City");
    expect(res.body.parcel.country_code).toBe("FR");
    expect(res.body.parcel.geometry.type).toBe("Polygon");
  });

  it("rejects a parcel without farmId, name, or a valid geometry", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/plots/parcels")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, name: "No shape" });
    expect(res.status).toBe(400);
  });

  it("rejects a non-Polygon geometry", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/plots/parcels")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, name: "Bad shape", geometry: { type: "Point", coordinates: [2.3, 48.85] } });
    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/plots/parcels")
      .send({ farmId: "x", name: "X", geometry: squarePolygon(0, 0) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user does not manage the farm", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const res = await request(app)
      .post("/api/plots/parcels")
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ farmId: farm.id, name: "Hijack", geometry: squarePolygon(0, 0) });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/plots/parcels/mine", () => {
  it("only returns parcels belonging to the requested farm", async () => {
    const { token } = await registerAndLogin();
    const farmA = await createFarm(token, { name: "Farm A" });
    const farmB = await createFarm(token, { name: "Farm B" });
    await createParcel(token, farmA.id, { name: "Parcel A" });
    await createParcel(token, farmB.id, { name: "Parcel B" });

    const res = await request(app)
      .get(`/api/plots/parcels/mine?farmId=${farmA.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.parcels).toHaveLength(1);
    expect(res.body.parcels[0].name).toBe("Parcel A");
  });

  it("requires farmId", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get("/api/plots/parcels/mine").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/plots/parcels/:id", () => {
  it("recomputes area when the geometry changes", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const parcel = await createParcel(token, farm.id, { geometry: squarePolygon(2.3, 48.85, 0.001) });
    const originalArea = parseFloat(parcel.area_ha);

    const res = await request(app)
      .patch(`/api/plots/parcels/${parcel.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ geometry: squarePolygon(2.3, 48.85, 0.002) }); // bigger square

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.parcel.area_ha)).toBeGreaterThan(originalArea);
  });

  it("returns 403 for a farm the user doesn't manage", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const parcel = await createParcel(owner.token, farm.id);

    const res = await request(app)
      .patch(`/api/plots/parcels/${parcel.id}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ name: "Hijacked" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/plots/parcels/:id", () => {
  it("deletes a parcel the user manages", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const parcel = await createParcel(token, farm.id);

    const res = await request(app)
      .delete(`/api/plots/parcels/${parcel.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app)
      .get(`/api/plots/parcels/mine?farmId=${farm.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.parcels).toHaveLength(0);
  });
});
