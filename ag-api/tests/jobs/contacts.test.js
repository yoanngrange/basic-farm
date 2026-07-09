const request = require("supertest");
const pool = require("../../src/db/pool");
const { app, registerAndLogin, createFarm, createListing } = require("../helpers/factories");
const { resetTenantData } = require("../helpers/reset");
const mailer = require("../../src/lib/mailer");

beforeEach(resetTenantData);
afterAll(() => pool.end());

async function publishedListing() {
  const { token } = await registerAndLogin();
  const farm = await createFarm(token);
  const listing = await createListing(token, farm.id);
  await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });
  return listing;
}

describe("POST /api/jobs/listings/:listingId/contacts", () => {
  it("records a contact_form submission without requiring authentication", async () => {
    const listing = await publishedListing();
    const res = await request(app)
      .post(`/api/jobs/listings/${listing.id}/contacts`)
      .send({ contactType: "contact_form", candidateEmail: "candidate@example.test", message: "Interested!" });

    expect(res.status).toBe(201);
    expect(res.body.contact.listing_id).toBe(listing.id);

    const row = await pool.query("SELECT candidate_email, ip_hash FROM jobs.listing_contacts WHERE id = $1", [res.body.contact.id]);
    expect(row.rows[0].candidate_email).toBe("candidate@example.test");
    expect(row.rows[0].ip_hash).not.toBeNull(); // stored as a hash, never the raw IP
  });

  it("records a phone_click event without an email", async () => {
    const listing = await publishedListing();
    const res = await request(app)
      .post(`/api/jobs/listings/${listing.id}/contacts`)
      .send({ contactType: "phone_click" });
    expect(res.status).toBe(201);
  });

  it("rejects a contact_form submission without candidateEmail", async () => {
    const listing = await publishedListing();
    const res = await request(app)
      .post(`/api/jobs/listings/${listing.id}/contacts`)
      .send({ contactType: "contact_form" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown contactType", async () => {
    const listing = await publishedListing();
    const res = await request(app)
      .post(`/api/jobs/listings/${listing.id}/contacts`)
      .send({ contactType: "carrier_pigeon" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent listing", async () => {
    const res = await request(app)
      .post("/api/jobs/listings/00000000-0000-0000-0000-000000000000/contacts")
      .send({ contactType: "phone_click" });
    expect(res.status).toBe(404);
  });
});

describe("farmer notification email", () => {
  afterEach(() => jest.restoreAllMocks());

  it("notifies the listing author with the candidate's email and message", async () => {
    const spy = jest.spyOn(mailer, "sendMail").mockResolvedValue({ skipped: false });
    const { token, email: authorEmail } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id, { title: "Notify Me" });
    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });

    await request(app)
      .post(`/api/jobs/listings/${listing.id}/contacts`)
      .send({ contactType: "contact_form", candidateEmail: "candidate@example.test", message: "Hello there" });

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    expect(call.to).toBe(authorEmail);
    expect(call.subject).toContain("Notify Me");
    expect(call.text).toContain("candidate@example.test");
    expect(call.text).toContain("Hello there");
  });

  it("still returns 201 to the candidate even if the notification email fails", async () => {
    jest.spyOn(mailer, "sendMail").mockRejectedValue(new Error("SMTP down"));
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id);
    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });

    const res = await request(app)
      .post(`/api/jobs/listings/${listing.id}/contacts`)
      .send({ contactType: "phone_click" });

    expect(res.status).toBe(201);
  });
});

describe("GET /api/jobs/contacts/mine", () => {
  it("lists contacts across every listing the user manages, most recent first", async () => {
    const { token } = await registerAndLogin();
    const farm = await createFarm(token);
    const listing = await createListing(token, farm.id, { title: "Contacted Listing" });
    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${token}`).send({ status: "published" });
    await request(app).post(`/api/jobs/listings/${listing.id}/contacts`).send({ contactType: "phone_click" });
    await request(app).post(`/api/jobs/listings/${listing.id}/contacts`).send({ contactType: "contact_form", candidateEmail: "x@example.test" });

    const res = await request(app).get("/api/jobs/contacts/mine").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(2);
    expect(res.body.contacts[0].listing_title).toBe("Contacted Listing");
  });

  it("does not return another user's contacts", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const farm = await createFarm(owner.token);
    const listing = await createListing(owner.token, farm.id);
    await request(app).patch(`/api/jobs/listings/${listing.id}`).set("Authorization", `Bearer ${owner.token}`).send({ status: "published" });
    await request(app).post(`/api/jobs/listings/${listing.id}/contacts`).send({ contactType: "phone_click" });

    const res = await request(app).get("/api/jobs/contacts/mine").set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(0);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/jobs/contacts/mine");
    expect(res.status).toBe(401);
  });
});
