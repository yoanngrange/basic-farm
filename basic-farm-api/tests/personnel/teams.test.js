const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

beforeEach(resetTenantData);
afterAll(() => pool.end());

async function createPerson(token, farmId, overrides = {}) {
  const res = await request(app)
    .post("/api/personnel/people")
    .set("Authorization", `Bearer ${token}`)
    .send({ farmId, firstName: overrides.firstName || "Jean", lastName: overrides.lastName || "Dupont" });
  return res.body.person;
}

describe("POST /api/personnel/teams", () => {
  it("creates a team with no members", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/personnel/teams")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, name: "Vendange" });
    expect(res.status).toBe(201);
    expect(res.body.team.name).toBe("Vendange");
    expect(res.body.team.members).toEqual([]);
  });

  it("returns 403 when the user does not manage the farm", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const res = await request(app)
      .post("/api/personnel/teams")
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ farmId: farm.id, name: "Hijack" });
    expect(res.status).toBe(403);
  });
});

describe("team membership", () => {
  it("adds and removes a member, and lists members on GET /mine", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const person = await createPerson(token, farm.id);
    const team = await request(app).post("/api/personnel/teams").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, name: "Vendange" }).then((r) => r.body.team);

    const addRes = await request(app)
      .post(`/api/personnel/teams/${team.id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ personId: person.id });
    expect(addRes.status).toBe(201);
    expect(addRes.body.team.members).toHaveLength(1);
    expect(addRes.body.team.members[0].id).toBe(person.id);

    const listRes = await request(app)
      .get(`/api/personnel/teams/mine?farmId=${farm.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.body.teams[0].members).toHaveLength(1);

    const removeRes = await request(app)
      .delete(`/api/personnel/teams/${team.id}/members/${person.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.team.members).toHaveLength(0);
  });

  it("rejects adding a person from a different farm", async () => {
    const { token } = await registerAndLogin();
    const farmA = await createFarm(token, { name: "Farm A" });
    const farmB = await createFarm(token, { name: "Farm B" });
    const person = await createPerson(token, farmB.id);
    const team = await request(app).post("/api/personnel/teams").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farmA.id, name: "Vendange" }).then((r) => r.body.team);

    const res = await request(app)
      .post(`/api/personnel/teams/${team.id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ personId: person.id });
    expect(res.status).toBe(404);
  });

  it("rejects adding the same person twice", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const person = await createPerson(token, farm.id);
    const team = await request(app).post("/api/personnel/teams").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, name: "Vendange" }).then((r) => r.body.team);

    await request(app).post(`/api/personnel/teams/${team.id}/members`).set("Authorization", `Bearer ${token}`)
      .send({ personId: person.id });
    const res = await request(app)
      .post(`/api/personnel/teams/${team.id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ personId: person.id });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/personnel/teams/:id", () => {
  it("renames a team", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const team = await request(app).post("/api/personnel/teams").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, name: "Vendange" }).then((r) => r.body.team);

    const res = await request(app)
      .patch(`/api/personnel/teams/${team.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Vendange 2026" });
    expect(res.status).toBe(200);
    expect(res.body.team.name).toBe("Vendange 2026");
  });
});

describe("DELETE /api/personnel/teams/:id", () => {
  it("deletes a team and cascades its membership rows", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const person = await createPerson(token, farm.id);
    const team = await request(app).post("/api/personnel/teams").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, name: "Vendange" }).then((r) => r.body.team);
    await request(app).post(`/api/personnel/teams/${team.id}/members`).set("Authorization", `Bearer ${token}`)
      .send({ personId: person.id });

    const res = await request(app)
      .delete(`/api/personnel/teams/${team.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app)
      .get(`/api/personnel/teams/mine?farmId=${farm.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.teams).toHaveLength(0);
  });
});
