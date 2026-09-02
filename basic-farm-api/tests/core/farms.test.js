const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

beforeEach(resetTenantData);
afterAll(() => pool.end());

describe("POST /api/core/farms", () => {
  it("creates a farm and links the creator as owner", async () => {
    const { token, user } = await registerAndLogin();
    const res = await request(app)
      .post("/api/core/farms")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Domaine Test", countryCode: "fr", farmType: "viticulture", locality: "Reims" });

    expect(res.status).toBe(201);
    expect(res.body.farm.country_code).toBe("FR"); // uppercased
    const link = await pool.query("SELECT role FROM core.users_farms WHERE user_id = $1 AND farm_id = $2", [
      user.id, res.body.farm.id,
    ]);
    expect(link.rows[0].role).toBe("owner");
  });

  it("rejects a farm without a name or countryCode", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).post("/api/core/farms").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/core/farms").send({ name: "X", countryCode: "FR" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/core/farms/mine", () => {
  it("only returns farms belonging to the authenticated user", async () => {
    const alice = await registerAndLogin();
    const bob = await registerAndLogin();
    await createFarm(alice.token, { name: "Alice Farm" });
    await createFarm(bob.token, { name: "Bob Farm" });

    const res = await request(app).get("/api/core/farms/mine").set("Authorization", `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.farms).toHaveLength(1);
    expect(res.body.farms[0].name).toBe("Alice Farm");
  });
});

describe("PATCH /api/core/farms/:id", () => {
  it("lets the owner update their farm", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .patch(`/api/core/farms/${farm.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Updated description" });
    expect(res.status).toBe(200);
    expect(res.body.farm.description).toBe("Updated description");
  });

  it("returns 403 when the user does not manage the farm", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);

    const res = await request(app)
      .patch(`/api/core/farms/${farm.id}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ description: "Hijacked" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when no updatable field is provided", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .patch(`/api/core/farms/${farm.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("GET /api/core/farms/:id (public profile)", () => {
  it("returns basic farm info without authentication", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token, { name: "Public Farm" });
    const res = await request(app).get(`/api/core/farms/${farm.id}`);
    expect(res.status).toBe(200);
    expect(res.body.farm.name).toBe("Public Farm");
  });

  it("never exposes contact_email, contact_phone or registration_number", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post("/api/core/farms")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sensitive Farm", countryCode: "FR", contactEmail: "secret@farm.example", contactPhone: "+33600000000" });
    const farm = res.body.farm;

    const publicRes = await request(app).get(`/api/core/farms/${farm.id}`);
    expect(publicRes.body.farm.contact_email).toBeUndefined();
    expect(publicRes.body.farm.contact_phone).toBeUndefined();
    expect(publicRes.body.farm.registration_number).toBeUndefined();
  });

  it("returns 404 for an unknown farm", async () => {
    const res = await request(app).get("/api/core/farms/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
