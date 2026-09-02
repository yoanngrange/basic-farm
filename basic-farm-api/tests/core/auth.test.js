const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

beforeEach(resetTenantData);
afterAll(() => pool.end());

describe("POST /api/core/auth/register", () => {
  it("creates a new user account", async () => {
    const res = await request(app).post("/api/core/auth/register").send({
      email: "farmer@basicfarm-tests.example",
      password: "supersecret123",
      firstName: "Yoann",
      lastName: "Test",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("farmer@basicfarm-tests.example");
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app).post("/api/core/auth/register").send({
      email: "short@basicfarm-tests.example", password: "abc", firstName: "A", lastName: "B",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing required fields", async () => {
    const res = await request(app).post("/api/core/auth/register").send({ email: "x@basicfarm-tests.example" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with 409", async () => {
    const payload = { email: "dup@basicfarm-tests.example", password: "supersecret123", firstName: "A", lastName: "B" };
    await request(app).post("/api/core/auth/register").send(payload);
    const res = await request(app).post("/api/core/auth/register").send(payload);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});

describe("POST /api/core/auth/login", () => {
  it("returns a JWT for valid credentials", async () => {
    await request(app).post("/api/core/auth/register").send({
      email: "login@basicfarm-tests.example", password: "supersecret123", firstName: "A", lastName: "B",
    });
    const res = await request(app).post("/api/core/auth/login").send({
      email: "login@basicfarm-tests.example", password: "supersecret123",
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.split(".")).toHaveLength(3); // header.payload.signature
  });

  it("rejects a wrong password with 401", async () => {
    await request(app).post("/api/core/auth/register").send({
      email: "wrongpw@basicfarm-tests.example", password: "supersecret123", firstName: "A", lastName: "B",
    });
    const res = await request(app).post("/api/core/auth/login").send({
      email: "wrongpw@basicfarm-tests.example", password: "totallywrong",
    });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown email with 401 (not 404 — avoids leaking which emails exist)", async () => {
    const res = await request(app).post("/api/core/auth/login").send({
      email: "doesnotexist@basicfarm-tests.example", password: "whatever123",
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/core/auth/me", () => {
  it("returns the current user when authenticated", async () => {
    const { token, user } = await registerAndLogin();
    const res = await request(app).get("/api/core/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/core/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a malformed token", async () => {
    const res = await request(app).get("/api/core/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
