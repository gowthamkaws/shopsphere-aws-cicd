import request from "supertest";

jest.mock("../src/config/database", () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }])
  }
}));

import app from "../src/app";

describe("ShopSphere API", () => {
  test("health endpoint returns healthy status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("healthy");
    expect(response.body.database).toBe("connected");
  });
});
