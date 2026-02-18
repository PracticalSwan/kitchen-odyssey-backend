import { describe, it, expect } from "vitest";
import { sanitizeString, sanitizeQuery, schemas } from "@/lib/validate.js";

describe("validate.js", () => {
  describe("sanitizeString", () => {
    it("strips HTML tags", () => {
      expect(sanitizeString('<script>alert("xss")</script>Hello')).toBe(
        'alert("xss")Hello',
      );
    });

    it("trims whitespace", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });

    it("limits length", () => {
      expect(sanitizeString("abcdef", 3)).toBe("abc");
    });

    it("returns empty string for non-string input", () => {
      expect(sanitizeString(null)).toBe("");
      expect(sanitizeString(123)).toBe("");
      expect(sanitizeString(undefined)).toBe("");
    });
  });

  describe("sanitizeQuery", () => {
    it("removes $ prefixed keys", () => {
      const result = sanitizeQuery({ name: "test", $gt: 100, $ne: null });
      expect(result).toEqual({ name: "test" });
    });

    it("recursively sanitizes nested objects", () => {
      const result = sanitizeQuery({ filter: { $or: [1, 2], valid: true } });
      expect(result).toEqual({ filter: { valid: true } });
    });

    it("handles arrays", () => {
      const result = sanitizeQuery([{ $gt: 1, name: "a" }]);
      expect(result).toEqual([{ name: "a" }]);
    });

    it("returns primitives unchanged", () => {
      expect(sanitizeQuery(null)).toBeNull();
      expect(sanitizeQuery("hello")).toBe("hello");
      expect(sanitizeQuery(42)).toBe(42);
    });
  });

  describe("schemas.email", () => {
    it("validates correct email", () => {
      const result = schemas.email("Test@Example.COM");
      expect(result.valid).toBe(true);
      expect(result.value).toBe("test@example.com");
    });

    it("rejects invalid email", () => {
      expect(schemas.email("notanemail").valid).toBe(false);
      expect(schemas.email("").valid).toBe(false);
    });

    it("rejects non-string", () => {
      expect(schemas.email(123).valid).toBe(false);
    });
  });

  describe("schemas.username", () => {
    it("validates correct username", () => {
      expect(schemas.username("john_doe").valid).toBe(true);
    });

    it("rejects too short", () => {
      expect(schemas.username("a").valid).toBe(false);
    });

    it("rejects special characters", () => {
      expect(schemas.username("john doe!").valid).toBe(false);
    });
  });

  describe("schemas.password", () => {
    it("validates sufficient length with complexity", () => {
      expect(schemas.password("Abcdefg1").valid).toBe(true);
    });

    it("rejects too short", () => {
      expect(schemas.password("Abcdef1").valid).toBe(false);
    });

    it("rejects missing uppercase", () => {
      expect(schemas.password("abcdefg1").valid).toBe(false);
    });

    it("rejects missing number", () => {
      expect(schemas.password("Abcdefgh").valid).toBe(false);
    });
  });

  describe("schemas.recipeTitle", () => {
    it("sanitizes and validates", () => {
      const result = schemas.recipeTitle("<b>Pasta</b> Recipe");
      expect(result.valid).toBe(true);
      expect(result.value).toBe("Pasta Recipe");
    });

    it("rejects empty after sanitization", () => {
      expect(schemas.recipeTitle("<script></script>").valid).toBe(false);
    });
  });

  describe("schemas.comment", () => {
    it("validates normal comment", () => {
      expect(schemas.comment("Great recipe!").valid).toBe(true);
    });

    it("rejects non-string", () => {
      expect(schemas.comment(null).valid).toBe(false);
    });
  });

  describe("schemas.searchQuery", () => {
    it("validates normal query", () => {
      expect(schemas.searchQuery("pasta").valid).toBe(true);
    });

    it("rejects empty", () => {
      expect(schemas.searchQuery("").valid).toBe(false);
    });
  });
});
