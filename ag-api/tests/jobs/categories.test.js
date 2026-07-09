const request = require("supertest");
const pool = require("../../src/db/pool");
const { app } = require("../helpers/factories");

afterAll(() => pool.end());

describe("GET /api/jobs/categories", () => {
  it("returns categories translated in the requested locale", async () => {
    const res = await request(app).get("/api/jobs/categories?locale=it");
    expect(res.status).toBe(200);
    const labels = res.body.categories.map((c) => c.label);
    expect(labels).toContain("Vendemmia");
  });

  it("defaults to English when no locale is given", async () => {
    const res = await request(app).get("/api/jobs/categories");
    expect(res.status).toBe(200);
    const labels = res.body.categories.map((c) => c.label);
    expect(labels).toContain("Grape Harvest");
  });

  it("returns an empty list for a locale with no translation rows", async () => {
    const res = await request(app).get("/api/jobs/categories?locale=de");
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
  });
});
