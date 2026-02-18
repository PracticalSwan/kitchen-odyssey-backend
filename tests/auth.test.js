import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers before importing auth
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Mock DB connection
vi.mock("@/lib/db.js", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

// Set JWT_SECRET for token generation
process.env.JWT_SECRET = "test-secret-key-for-vitest-min-32chars!";

const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  setAuthCookies,
  clearAuthCookies,
} = await import("@/lib/auth.js");

describe("auth.js — token utilities", () => {
  const mockUser = { _id: "user-1", role: "user", tokenVersion: 0 };
  const mockAdmin = { _id: "admin-1", role: "admin", tokenVersion: 0 };

  describe("generateAccessToken", () => {
    it("generates a valid JWT", () => {
      const token = generateAccessToken(mockUser);
      expect(token).toBeTruthy();
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe("user-1");
      expect(decoded.role).toBe("user");
      expect(decoded.type).toBe("access");
    });

    it("includes tokenVersion", () => {
      const token = generateAccessToken({ ...mockUser, tokenVersion: 3 });
      const decoded = verifyToken(token);
      expect(decoded.tokenVersion).toBe(3);
    });
  });

  describe("generateRefreshToken", () => {
    it("generates a refresh-type JWT", () => {
      const token = generateRefreshToken(mockUser);
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe("user-1");
      expect(decoded.type).toBe("refresh");
    });
  });

  describe("verifyToken", () => {
    it("returns null for invalid token", () => {
      const result = verifyToken("invalid.token.here");
      expect(result).toBeNull();
    });

    it("returns null for tampered token", () => {
      const token = generateAccessToken(mockUser);
      const tampered = token.slice(0, -3) + "xxx";
      expect(verifyToken(tampered)).toBeNull();
    });
  });

  describe("setAuthCookies", () => {
    it("sets access, refresh, and csrf Set-Cookie headers on response", () => {
      const headers = new Headers();
      const response = { headers };
      setAuthCookies(response, "access-tok", "refresh-tok");
      const cookies = headers.getSetCookie();
      expect(cookies.length).toBe(3);
      expect(
        cookies.some((cookie) => cookie.includes("ko_access=access-tok")),
      ).toBe(true);
      expect(
        cookies.some((cookie) => cookie.includes("ko_refresh=refresh-tok")),
      ).toBe(true);
      expect(cookies.some((cookie) => cookie.includes("ko_csrf="))).toBe(true);
    });

    it("includes HttpOnly flag", () => {
      const headers = new Headers();
      const response = { headers };
      setAuthCookies(response, "a", "r");
      const cookies = headers.getSetCookie();
      expect(cookies[0]).toContain("HttpOnly");
    });
  });

  describe("clearAuthCookies", () => {
    it("sets Max-Age=0 on access, refresh, and csrf cookies", () => {
      const headers = new Headers();
      const response = { headers };
      clearAuthCookies(response);
      const cookies = headers.getSetCookie();
      expect(cookies.length).toBe(3);
      expect(cookies.every((cookie) => cookie.includes("Max-Age=0"))).toBe(
        true,
      );
      expect(cookies.some((cookie) => cookie.includes("ko_access="))).toBe(
        true,
      );
      expect(cookies.some((cookie) => cookie.includes("ko_refresh="))).toBe(
        true,
      );
      expect(cookies.some((cookie) => cookie.includes("ko_csrf="))).toBe(true);
    });
  });
});
