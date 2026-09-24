const request = require("supertest");

describe("Auth API", () => {
  it("POST /api/auth/register should reject invalid email", async () => {
    const app = require("../src/app");
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "not-an-email",
      password: "123456",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST /api/auth/login should reject missing password", async () => {
    const app = require("../src/app");
    const res = await request(app).post("/api/auth/login").send({ email: "test@example.com" });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
