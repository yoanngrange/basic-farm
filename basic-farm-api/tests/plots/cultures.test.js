const request = require("supertest");
const pool = require("../../src/db/pool");
const { app } = require("../helpers/factories");

afterAll(() => pool.end());

describe("GET /api/plots/cultures", () => {
  it("returns cultures translated in the requested locale", async () => {
    const res = await request(app).get("/api/plots/cultures?locale=fr");
    expect(res.status).toBe(200);
    const labels = res.body.cultures.map((c) => c.label);
    expect(labels).toContain("Blé");
  });

  it("defaults to English when no locale is given", async () => {
    const res = await request(app).get("/api/plots/cultures");
    expect(res.status).toBe(200);
    const labels = res.body.cultures.map((c) => c.label);
    expect(labels).toContain("Wheat");
  });

  it("returns an empty list for a locale with no translation rows", async () => {
    const res = await request(app).get("/api/plots/cultures?locale=de");
    expect(res.status).toBe(200);
    expect(res.body.cultures).toEqual([]);
  });
});
