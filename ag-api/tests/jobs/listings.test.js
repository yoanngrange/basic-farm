const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm, createListing } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");

const GRAPE_CATEGORY_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(resetTenantData);
afterAll(() => pool.end());

describe("POST /api/jobs/listings", () => {
  it("creates a draft listing with a slug that embeds its own id", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id, { title: "Vendange en Loire" });

    expect(listing.status).toBe("draft");
    expect(listing.slug.startsWith(listing.id)).toBe(true);
    expect(listing.slug).toContain("vendange-en-loire");
  });

  it("rejects creation without title/description", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/jobs/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id });
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported language", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const res = await request(app)
      .post("/api/jobs/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ farmId: farm.id, title: "X", description: "Y", language: "de" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when creating a listing for a farm you do not manage", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const res = await request(app)
      .post("/api/jobs/listings")
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ farmId: farm.id, title: "X", description: "Y" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/jobs/listings/:id", () => {
  it("sets published_at when the status moves to published", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);

    const res = await request(app)
      .patch(`/api/jobs/listings/${listing.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "published" });

    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe("published");
    expect(res.body.listing.published_at).not.toBeNull();
  });

  it("rejects an invalid status value", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);
    const res = await request(app)
      .patch(`/api/jobs/listings/${listing.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "not-a-real-status" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/jobs/listings (public browsing)", () => {
  async function seedListings() {
    const { token } = await registerAndLogin();
    const frFarm = await createFarm(token, { countryCode: "FR" });
    const esFarm = await createFarm(token, { countryCode: "ES" });

    const l1 = await createListing(token, frFarm.id, { title: "Vendange Bordeaux", language: "fr", categoryId: GRAPE_CATEGORY_ID });
    const l2 = await createListing(token, frFarm.id, { title: "Cueillette Angers", language: "fr" });
    const l3 = await createListing(token, esFarm.id, { title: "Vendimia Valencia", language: "es", categoryId: GRAPE_CATEGORY_ID });

    for (const l of [l1, l2, l3]) {
      await request(app).patch(`/api/jobs/listings/${l.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });
    }
    return { token, l1, l2, l3 };
  }

  it("only returns published listings by default", async () => {
    const { token, l1 } = await seedListings();
    const farm2 = await createFarm(token);
    await createListing(token, farm2.id, { title: "Still a draft" }); // never published

    const res = await request(app).get("/api/jobs/listings");
    expect(res.status).toBe(200);
    const titles = res.body.listings.map((l) => l.title);
    expect(titles).not.toContain("Still a draft");
    expect(titles.find((t) => t.includes("Bordeaux"))).toBeTruthy();
  });

  it("filters by language", async () => {
    await seedListings();
    const res = await request(app).get("/api/jobs/listings?language=es");
    expect(res.status).toBe(200);
    expect(res.body.listings.every((l) => l.language === "es")).toBe(true);
    expect(res.body.listings.length).toBeGreaterThan(0);
  });

  it("filters by country via the farm join", async () => {
    await seedListings();
    const res = await request(app).get("/api/jobs/listings?country=fr");
    expect(res.status).toBe(200);
    expect(res.body.listings.every((l) => l.country_code === "FR")).toBe(true);
  });

  it("filters by category slug", async () => {
    await seedListings();
    const res = await request(app).get("/api/jobs/listings?category=grape-harvest");
    expect(res.status).toBe(200);
    expect(res.body.listings.every((l) => l.category_slug === "grape-harvest")).toBe(true);
    expect(res.body.listings.length).toBe(2); // l1 (fr) + l3 (es)
  });

  it("paginates correctly", async () => {
    await seedListings();
    const page1 = await request(app).get("/api/jobs/listings?pageSize=2&page=1");
    const page2 = await request(app).get("/api/jobs/listings?pageSize=2&page=2");

    expect(page1.body.listings.length).toBe(2);
    expect(page1.body.pagination.total).toBe(3);
    expect(page1.body.pagination.totalPages).toBe(2);
    expect(page2.body.listings.length).toBe(1);

    const idsPage1 = page1.body.listings.map((l) => l.id);
    const idsPage2 = page2.body.listings.map((l) => l.id);
    expect(idsPage1.some((id) => idsPage2.includes(id))).toBe(false); // no overlap
  });

  it("caps pageSize at 100", async () => {
    await seedListings();
    const res = await request(app).get("/api/jobs/listings?pageSize=9999");
    expect(res.body.pagination.pageSize).toBe(100);
  });
});

describe("GET /api/jobs/listings/mine", () => {
  it("returns every listing across every farm the user manages, any status", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    await createListing(token, farm.id, { title: "Draft one" }); // stays draft

    const res = await request(app).get("/api/jobs/listings/mine").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.listings).toHaveLength(1);
    expect(res.body.listings[0].status).toBe("draft");
  });

  it("does not return another user's listings", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    await createListing(owner.token, farm.id);

    const res = await request(app).get("/api/jobs/listings/mine").set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(200);
    expect(res.body.listings).toHaveLength(0);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/jobs/listings/mine");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/jobs/listings/:id/reveal-contact", () => {
  it("rejects a missing captchaToken with 400", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);
    const res = await request(app).get(`/api/jobs/listings/${listing.id}/reveal-contact`);
    expect(res.status).toBe(400);
  });

  it("rejects a failed captcha verification with 401 (dev bypass treats token 'invalid' as failed)", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);
    const res = await request(app).get(`/api/jobs/listings/${listing.id}/reveal-contact?captchaToken=invalid`);
    expect(res.status).toBe(401);
  });

  it("returns null contact fields when the farm hasn't provided any", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);
    const res = await request(app).get(`/api/jobs/listings/${listing.id}/reveal-contact?captchaToken=valid-test-token`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBeNull();
    expect(res.body.phone).toBeNull();
  });

  it("returns the farm's public contact info once verified", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post("/api/core/farms")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Contact Farm", countryCode: "FR", contactEmail: "contact@farm.example", contactPhone: "+33600000000" });
    const farm = res.body.farm;
    const listing = await createListing(token, farm.id);

    const revealRes = await request(app).get(`/api/jobs/listings/${listing.id}/reveal-contact?captchaToken=valid-test-token`);
    expect(revealRes.status).toBe(200);
    expect(revealRes.body.email).toBe("contact@farm.example");
    expect(revealRes.body.phone).toBe("+33600000000");
  });

  it("never leaks contact info through the regular public listing fetch", async () => {
    const { token } = await registerAndLogin();
    const farmRes = await request(app)
      .post("/api/core/farms")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hidden Farm", countryCode: "FR", contactEmail: "secret@farm.example" });
    const farm = farmRes.body.farm;
    const listing = await createListing(token, farm.id);
    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });

    const res = await request(app).get(`/api/jobs/listings/${listing.slug}`);
    expect(JSON.stringify(res.body)).not.toContain("secret@farm.example");
  });

  it("returns 404 for a non-existent listing", async () => {
    const res = await request(app).get("/api/jobs/listings/00000000-0000-0000-0000-000000000000/reveal-contact?captchaToken=valid-test-token");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/jobs/listings/:slug", () => {
  it("returns the listing and increments view_count on each fetch", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);
    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });

    const first = await request(app).get(`/api/jobs/listings/${listing.slug}`);
    const second = await request(app).get(`/api/jobs/listings/${listing.slug}`);

    expect(first.status).toBe(200);
    expect(second.body.listing.view_count).toBe(first.body.listing.view_count + 1);
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await request(app).get("/api/jobs/listings/does-not-exist-uuid-title");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/jobs/listings?farmId=", () => {
  it("filters published listings down to a single farm", async () => {
    const { token } = await registerAndLogin();
    const farmA = await createFarm(token, { name: "Farm A" });
    const farmB = await createFarm(token, { name: "Farm B" });
    const l1 = await createListing(token, farmA.id, { title: "A1" });
    await createListing(token, farmB.id, { title: "B1" });
    await request(app).patch(`/api/jobs/listings/${l1.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });
    const l1b = await createListing(token, farmA.id, { title: "A2" });
    await request(app).patch(`/api/jobs/listings/${l1b.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });

    const res = await request(app).get(`/api/jobs/listings?farmId=${farmA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.listings).toHaveLength(2);
    expect(res.body.listings.every((l) => l.farm_name === "Farm A")).toBe(true);
  });
});

describe("site rebuild trigger on status change", () => {
  afterEach(() => jest.restoreAllMocks());

  it("triggers a rebuild when status changes", async () => {
    const githubDispatch = require("../../src/lib/githubDispatch");
    const spy = jest.spyOn(githubDispatch, "triggerSiteRebuild").mockResolvedValue({ skipped: false });
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);

    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });
    await new Promise((resolve) => setImmediate(resolve)); // let the fire-and-forget call fire

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("published");
  });

  it("does not trigger a rebuild for content-only updates (no status field)", async () => {
    const githubDispatch = require("../../src/lib/githubDispatch");
    const spy = jest.spyOn(githubDispatch, "triggerSiteRebuild").mockResolvedValue({ skipped: false });
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);

    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ title: "New title" });
    await new Promise((resolve) => setImmediate(resolve));

    expect(spy).not.toHaveBeenCalled();
  });

  it("triggers a rebuild when editing the content of an already-published listing", async () => {
    const githubDispatch = require("../../src/lib/githubDispatch");
    const spy = jest.spyOn(githubDispatch, "triggerSiteRebuild").mockResolvedValue({ skipped: false });
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);
    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });
    spy.mockClear(); // ignore the rebuild triggered by the publish itself

    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ title: "Updated title" });
    await new Promise((resolve) => setImmediate(resolve));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
