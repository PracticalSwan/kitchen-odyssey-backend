import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub config before importing rateLimit
vi.mock("@/lib/config.js", () => ({
  config: {
    rateLimit: {
      windowMs: 1000,
      maxAuth: 3,
      maxWrite: 5,
      maxRead: 10,
    },
  },
}));

const { rateLimit, rateLimitResponse } = await import("@/lib/rateLimit.js");

function mockRequest(ip = "1.2.3.4") {
  return {
    headers: {
      get(name) {
        if (name === "x-forwarded-for") return ip;
        return null;
      },
    },
  };
}

describe("rateLimit.js", () => {
  it("allows requests under the limit", async () => {
    const check = rateLimit("auth");
    const req = mockRequest("10.0.0.1");
    const r1 = await check(req);
    expect(r1.allowed).toBe(true);
    const r2 = await check(req);
    expect(r2.allowed).toBe(true);
    const r3 = await check(req);
    expect(r3.allowed).toBe(true);
  });

  it("blocks requests over the limit", async () => {
    const check = rateLimit("auth");
    const req = mockRequest("10.0.0.2");
    await check(req); // 1
    await check(req); // 2
    await check(req); // 3
    const r4 = await check(req); // 4 — over maxAuth=3
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
  });

  it("uses different limits per type", async () => {
    const checkWrite = rateLimit("write");
    const req = mockRequest("10.0.0.3");
    for (let i = 0; i < 5; i++) {
      const r = await checkWrite(req);
      expect(r.allowed).toBe(true);
    }
    const r6 = await checkWrite(req); // 6 — over maxWrite=5
    expect(r6.allowed).toBe(false);
  });

  it("isolates by IP", async () => {
    const check = rateLimit("auth");
    const req1 = mockRequest("10.0.0.4");
    const req2 = mockRequest("10.0.0.5");
    await check(req1);
    await check(req1);
    await check(req1);
    const r1 = await check(req1); // 4th for IP .4 — blocked
    expect(r1.allowed).toBe(false);

    const r2 = await check(req2); // 1st for IP .5 — allowed
    expect(r2.allowed).toBe(true);
  });

  describe("rateLimitResponse", () => {
    it("returns 429 with JSON body", () => {
      const response = rateLimitResponse({
        "Access-Control-Allow-Origin": "*",
      });
      expect(response.status).toBe(429);
    });
  });
});
