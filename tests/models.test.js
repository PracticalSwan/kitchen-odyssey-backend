import { describe, it, expect, vi, beforeAll } from "vitest";
import mongoose from "mongoose";

// Prevent actual DB connection
vi.mock("@/lib/db.js", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

describe("Mongoose model schemas", () => {
  let User, Recipe, Review, SearchHistory, DailyStat, ActivityLog;

  beforeAll(async () => {
    const models = await import("@/models/index.js");
    User = models.User;
    Recipe = models.Recipe;
    Review = models.Review;
    SearchHistory = models.SearchHistory;
    DailyStat = models.DailyStat;
    ActivityLog = models.ActivityLog;
  });

  describe("User schema", () => {
    it("rejects missing required fields", async () => {
      const user = new User({});
      const err = user.validateSync();
      expect(err).toBeTruthy();
      expect(err.errors.username).toBeTruthy();
      expect(err.errors.email).toBeTruthy();
      expect(err.errors.passwordHash).toBeTruthy();
    });

    it("accepts valid user data", async () => {
      const user = new User({
        _id: "user-test",
        username: "John",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        passwordHash: "$2b$10$hash",
        role: "user",
        status: "active",
      });
      const err = user.validateSync();
      expect(err).toBeUndefined();
    });

    it("defaults role to user and status to inactive", () => {
      const user = new User({
        _id: "u1",
        username: "A",
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        passwordHash: "x",
      });
      expect(user.role).toBe("user");
      expect(user.status).toBe("inactive");
    });

    it("rejects invalid role", () => {
      const user = new User({
        _id: "u1",
        username: "A",
        email: "a@b.com",
        passwordHash: "x",
        role: "superadmin",
      });
      const err = user.validateSync();
      expect(err.errors.role).toBeTruthy();
    });

    it("strips passwordHash from JSON output", () => {
      const user = new User({
        _id: "u2",
        username: "B",
        email: "b@b.com",
        passwordHash: "secrethash",
      });
      const json = user.toJSON();
      expect(json.passwordHash).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });

  describe("Recipe schema", () => {
    it("rejects missing title", () => {
      const recipe = new Recipe({ _id: "r1" });
      const err = recipe.validateSync();
      expect(err.errors.title).toBeTruthy();
    });

    it("accepts valid recipe with all required fields", () => {
      const recipe = new Recipe({
        _id: "r1",
        title: "Pasta Carbonara",
        description: "Classic Italian pasta",
        category: "Italian",
        prepTime: 10,
        cookTime: 20,
        servings: 2,
        difficulty: "Easy",
        ingredients: [{ name: "Spaghetti", quantity: "200", unit: "g" }],
        instructions: ["Cook pasta", "Add sauce"],
        authorId: "user-1",
      });
      const err = recipe.validateSync();
      expect(err).toBeUndefined();
    });

    it("defaults status to pending", () => {
      const recipe = new Recipe({ _id: "r1", title: "X", authorId: "u1" });
      expect(recipe.status).toBe("pending");
    });

    it("has likeCount and viewCount virtuals", () => {
      const recipe = new Recipe({
        _id: "r1",
        title: "X",
        authorId: "u1",
        likedBy: ["a", "b", "c"],
        viewedBy: ["a", "b"],
      });
      expect(recipe.likeCount).toBe(3);
      expect(recipe.viewCount).toBe(2);
    });
  });

  describe("Review schema", () => {
    it("requires rating between 1-5", () => {
      const r = new Review({
        _id: "rv1",
        recipeId: "r1",
        userId: "u1",
        rating: 6,
      });
      const err = r.validateSync();
      expect(err.errors.rating).toBeTruthy();
    });

    it("accepts valid review", () => {
      const r = new Review({
        _id: "rv1",
        recipeId: "r1",
        userId: "u1",
        rating: 4,
        comment: "Good",
      });
      expect(r.validateSync()).toBeUndefined();
    });
  });

  describe("SearchHistory schema", () => {
    it("requires userId and query", () => {
      const sh = new SearchHistory({ _id: "sh1" });
      const err = sh.validateSync();
      expect(err.errors.userId).toBeTruthy();
      expect(err.errors.query).toBeTruthy();
    });
  });

  describe("DailyStat schema", () => {
    it("defaults arrays to empty", () => {
      const ds = new DailyStat({ _id: "2025-01-01" });
      expect(ds.newUsers).toHaveLength(0);
      expect(ds.activeUsers).toHaveLength(0);
      expect(ds.views).toHaveLength(0);
    });
  });

  describe("ActivityLog schema", () => {
    it("requires type", () => {
      const al = new ActivityLog({ _id: "al1" });
      const err = al.validateSync();
      expect(err.errors.type).toBeTruthy();
    });

    it("defaults message to empty string", () => {
      const al = new ActivityLog({
        _id: "al1",
        type: "test",
        message: undefined,
      });
      expect(al.message).toBe("");
    });
  });
});
