// API route for recipes - handles GET list/filter/sort and POST create
import { connectDB } from "@/lib/db.js";
import { successResponse, errors, safeErrorResponse } from "@/lib/response.js";
import { getAuthUser, requireAuth } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { rateLimit, rateLimitResponse } from "@/lib/rateLimit.js";
import { sanitizeString } from "@/lib/validate.js";
import { Recipe, Review, ActivityLog, User } from "@/models/index.js";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/recipes — Public, supports filter/sort/pagination
export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "30", 10)),
    );
    const VALID_SORTS = ["newest", "trending", "rating", "title"];
    const VALID_DIFFICULTIES = ["Easy", "Medium", "Hard"];
    const sortParam = searchParams.get("sort") || "newest";
    const sort = VALID_SORTS.includes(sortParam) ? sortParam : "newest";
    const category = searchParams.get("category");
    const difficultyParam = searchParams.get("difficulty");
    const difficulty =
      difficultyParam && VALID_DIFFICULTIES.includes(difficultyParam)
        ? difficultyParam
        : null;
    const search = sanitizeString(searchParams.get("search") || "", 200);
    const status = searchParams.get("status");
    const authorId = searchParams.get("authorId");

    // Auth check for non-published recipes
    const authUser = await getAuthUser(request);

    const filter = {};

    // Default: only published recipes for non-admin
    if (authUser?.role === "admin" && status) {
      filter.status = status;
    } else if (authUser?.role === "admin") {
      // Admin sees all
    } else if (authorId && authUser?.userId && authorId === authUser.userId) {
      // Users can see all their own recipes (pending, rejected, published)
      if (status) filter.status = status;
    } else {
      filter.status = "published";
    }

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty; // already validated above
    if (authorId) filter.authorId = authorId;
    if (search) {
      filter.$text = { $search: search };
    }

    const needsAggregateSort = sort === "trending" || sort === "rating";

    let recipes;
    let total;

    if (needsAggregateSort) {
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            likeCount: { $size: { $ifNull: ["$likedBy", []] } },
          },
        },
      ];

      if (sort === "rating") {
        pipeline.push(
          {
            $lookup: {
              from: "reviews",
              localField: "_id",
              foreignField: "recipeId",
              as: "_reviews",
            },
          },
          {
            $addFields: {
              averageRating: { $ifNull: [{ $avg: "$_reviews.rating" }, 0] },
              reviewCount: { $size: "$_reviews" },
            },
          },
          { $project: { _reviews: 0 } },
          {
            $sort: {
              averageRating: -1,
              reviewCount: -1,
              likeCount: -1,
              createdAt: -1,
            },
          },
        );
      } else {
        pipeline.push({ $sort: { likeCount: -1, createdAt: -1 } });
      }

      pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });

      [recipes, total] = await Promise.all([
        Recipe.aggregate(pipeline),
        Recipe.countDocuments(filter),
      ]);
    } else {
      // Default sort options for simple query path.
      let sortObj = { createdAt: -1 }; // newest default
      if (sort === "title") {
        sortObj = { title: 1 };
      }

      [recipes, total] = await Promise.all([
        Recipe.find(filter)
          .sort(sortObj)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Recipe.countDocuments(filter),
      ]);
    }

    return successResponse(
      {
        recipes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      null,
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// POST /api/v1/recipes — Create recipe (active users only)
export async function POST(request) {
  const cors = getCorsHeaders(request);

  const limit = await rateLimit("write")(request);
  if (!limit.allowed) return rateLimitResponse(cors);

  try {
    await connectDB();
    const authUser = await requireAuth(request);

    if (authUser.status !== "active") {
      return errors.forbidden("Account must be active to create recipes", cors);
    }

    const body = await request.json();

    // Generate sequential recipe ID (recipe-1, recipe-2, ...)
    const lastRecipe = await Recipe.findOne(
      { _id: { $regex: /^recipe-\d+$/ } },
      { _id: 1 },
      { sort: { _id: -1 } },
    ).lean();
    let nextNum = 1;
    if (lastRecipe) {
      // Extract all numeric recipe IDs and find the max
      const allNumeric = await Recipe.find(
        { _id: { $regex: /^recipe-\d+$/ } },
        { _id: 1 },
      ).lean();
      nextNum =
        Math.max(...allNumeric.map((r) => parseInt(r._id.split("-")[1], 10))) +
        1;
    }
    const recipeId = `recipe-${nextNum}`;

    const recipe = await Recipe.create({
      _id: recipeId,
      title: sanitizeString(body.title || "", 100),
      description: sanitizeString(body.description || "", 1000),
      category: sanitizeString(body.category || "", 100),
      prepTime: Number.isFinite(Number(body.prepTime))
        ? Math.max(0, Number(body.prepTime))
        : 0,
      cookTime: Number.isFinite(Number(body.cookTime))
        ? Math.max(0, Number(body.cookTime))
        : 0,
      servings: Number.isFinite(Number(body.servings))
        ? Math.max(1, Math.round(Number(body.servings)))
        : 1,
      difficulty: ["Easy", "Medium", "Hard"].includes(body.difficulty)
        ? body.difficulty
        : "Easy",
      ingredients: Array.isArray(body.ingredients)
        ? body.ingredients.map((item) => ({
            name: sanitizeString(item?.name || "", 100),
            quantity: sanitizeString(item?.quantity || "", 50),
            unit: sanitizeString(item?.unit || "", 30),
          }))
        : [],
      instructions: Array.isArray(body.instructions)
        ? body.instructions.map((step) => sanitizeString(step || "", 1000))
        : [],
      images: body.images || [],
      imageUrl: body.images?.[0] || body.imageUrl || null,
      imageAltText: body.title,
      authorId: authUser.userId,
      status: "pending",
      likedBy: [],
      viewedBy: [],
    });

    // Log user activity (non-blocking)
    try {
      const author = await User.findById(authUser.userId, "username").lean();
      const authorName = author?.username || "A user";
      await ActivityLog.create({
        _id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: "user-recipe",
        message: `${authorName} submitted a new recipe "${recipe.title}"`,
        userId: authUser.userId,
        targetId: recipeId,
        metadata: { action: "create" },
      });
    } catch { /* activity logging is non-critical */ }

    return successResponse(
      { recipe: recipe.toJSON() },
      "Recipe created",
      201,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
