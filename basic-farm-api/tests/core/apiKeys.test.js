const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm, createApiKey } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

beforeEach(resetTenantData);
afterAll(() => pool.end());

describe("POST /api/core/farms/:farmId/api-keys", () => {
  it("creates a key and returns the raw value once", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post(`/api/core/farms/${farm.id}/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "n8n" });

    expect(res.status).toBe(201);
    expect(res.body.rawKey).toMatch(/^bf_/);
    expect(res.body.apiKey.scope).toBe("read");
    expect(res.body.apiKey.key_preview).toBe(res.body.rawKey.slice(-6));
    expect(res.body.apiKey.created_by.email).toBeDefined();
  });

  it("defaults to read scope and rejects an invalid scope", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post(`/api/core/farms/${farm.id}/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad scope", scope: "delete_everything" });
    expect(res.status).toBe(400);
  });

  it("rejects a key without a name", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post(`/api/core/farms/${farm.id}/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 403 when the user does not manage the farm", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const res = await request(app)
      .post(`/api/core/farms/${farm.id}/api-keys`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ name: "Hijack" });
    expect(res.status).toBe(403);
  });

  it("enforces the per-farm API key limit", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    for (let i = 0; i < 20; i++) {
      await createApiKey(token, farm.id, { name: `key-${i}` });
    }
    const res = await request(app)
      .post(`/api/core/farms/${farm.id}/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "One too many" });
    expect(res.status).toBe(400);
  }, 20000);
});

describe("GET /api/core/farms/:farmId/api-keys", () => {
  it("never exposes the raw key, only a preview", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    await createApiKey(token, farm.id);

    const res = await request(app)
      .get(`/api/core/farms/${farm.id}/api-keys`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].rawKey).toBeUndefined();
    expect(res.body.items[0].key_preview).toHaveLength(6);
  });
});

describe("DELETE /api/core/farms/:farmId/api-keys/:keyId", () => {
  it("deletes the key and immediately invalidates it for /api/v1", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const { apiKey, rawKey } = await createApiKey(token, farm.id);

    const del = await request(app)
      .delete(`/api/core/farms/${farm.id}/api-keys/${apiKey.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const v1Res = await request(app).get("/api/v1/parcels").set("Authorization", `Bearer ${rawKey}`);
    expect(v1Res.status).toBe(401);
  });

  it("returns 404 for a key that doesn't belong to this farm", async () => {
    const { token } = await registerAndLogin();
    const farmA = await createFarm(token, { name: "Farm A" });
    const farmB = await createFarm(token, { name: "Farm B" });
    const { apiKey } = await createApiKey(token, farmA.id);

    const res = await request(app)
      .delete(`/api/core/farms/${farmB.id}/api-keys/${apiKey.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
