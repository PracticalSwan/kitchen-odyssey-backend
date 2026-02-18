import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config to control allowed origins
vi.mock("@/lib/config.js", () => ({
  config: {
    cors: {
      allowedOrigins: ["http://localhost:5173", "https://app.example.com"],
    },
  },
}));

const { getCorsHeaders, handleOptions, corsResponse } = await import(
  "@/lib/cors.js"
);

function makeRequest(origin) {
  return { headers: new Headers(origin ? { origin } : {}) };
}

describe("cors.js", () => {
  describe("getCorsHeaders", () => {
    it("returns matching origin when allowed", () => {
      const headers = getCorsHeaders(makeRequest("http://localhost:5173"));
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:5173",
      );
    });

    it("omits origin for disallowed origin", () => {
      const headers = getCorsHeaders(makeRequest("http://evil.com"));
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("omits origin when no origin header", () => {
      const headers = getCorsHeaders(makeRequest(null));
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("includes credentials and methods", () => {
      const headers = getCorsHeaders(makeRequest("http://localhost:5173"));
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
      expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
      expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
      expect(headers.Vary).toBe("Origin");
    });
  });

  describe("handleOptions", () => {
    it("returns 204 with CORS headers", () => {
      const res = handleOptions(makeRequest("http://localhost:5173"));
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:5173",
      );
    });
  });

  describe("corsResponse", () => {
    it("wraps body with CORS headers", async () => {
      const res = corsResponse(
        { ok: true },
        { status: 200 },
        makeRequest("https://app.example.com"),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://app.example.com",
      );
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });
});
