const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

beforeEach(resetTenantData);
afterAll(() => pool.end());

describe("POST /api/personnel/people", () => {
  it("creates a person", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/personnel/people")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, firstName: "Jean", lastName: "Dupont", roleTitle: "Tractoriste" });

    expect(res.status).toBe(201);
    expect(res.body.person.first_name).toBe("Jean");
    expect(res.body.person.status).toBe("active");
  });

  it("rejects a person without firstName/lastName", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/personnel/people")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, firstName: "Jean" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when the user does not manage the farm", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const res = await request(app)
      .post("/api/personnel/people")
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ farmId: farm.id, firstName: "Jean", lastName: "Dupont" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/personnel/people/bulk", () => {
  it("creates several people from a list, transactionally", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/personnel/people/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        farmId: farm.id,
        people: [
          { firstName: "Jean", lastName: "Dupont" },
          { firstName: "Marie", lastName: "Martin", roleTitle: "Chef d'equipe" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.people).toHaveLength(2);
  });

  it("rejects the whole batch if one row is invalid", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/personnel/people/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, people: [{ firstName: "Jean", lastName: "Dupont" }, { firstName: "NoLastName" }] });
    expect(res.status).toBe(400);

    const list = await request(app)
      .get(`/api/personnel/people/mine?farmId=${farm.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.people).toHaveLength(0);
  });
});

describe("GET /api/personnel/people/mine", () => {
  it("only returns people belonging to the requested farm", async () => {
    const { token } = await registerAndLogin();
    const farmA = await createFarm(token, { name: "Farm A" });
    const farmB = await createFarm(token, { name: "Farm B" });
    await request(app).post("/api/personnel/people").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farmA.id, firstName: "A", lastName: "A" });
    await request(app).post("/api/personnel/people").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farmB.id, firstName: "B", lastName: "B" });

    const res = await request(app)
      .get(`/api/personnel/people/mine?farmId=${farmA.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.people).toHaveLength(1);
    expect(res.body.people[0].first_name).toBe("A");
  });
});

describe("PATCH /api/personnel/people/:id", () => {
  it("updates a person's fields, including status", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const created = await request(app).post("/api/personnel/people").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, firstName: "Jean", lastName: "Dupont" });

    const res = await request(app)
      .patch(`/api/personnel/people/${created.body.person.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive", roleTitle: "Retraite" });
    expect(res.status).toBe(200);
    expect(res.body.person.status).toBe("inactive");
    expect(res.body.person.role_title).toBe("Retraite");
  });

  it("returns 403 for a farm the user doesn't manage", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const created = await request(app).post("/api/personnel/people").set("Authorization", `Bearer ${owner.token}`)
      .send({ farmId: farm.id, firstName: "Jean", lastName: "Dupont" });

    const res = await request(app)
      .patch(`/api/personnel/people/${created.body.person.id}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ status: "inactive" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/personnel/people/:id", () => {
  it("deletes a person the user manages", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const created = await request(app).post("/api/personnel/people").set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, firstName: "Jean", lastName: "Dupont" });

    const res = await request(app)
      .delete(`/api/personnel/people/${created.body.person.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});
