import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { getAuthUser, requireAuth } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit.js';
import { sanitizeString } from '@/lib/validate.js';
import { Recipe, Review } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/recipes — Public, supports filter/sort/pagination
export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const sort = searchParams.get('sort') || 'newest';
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const search = sanitizeString(searchParams.get('search') || '', 200);
    const status = searchParams.get('status');
    const authorId = searchParams.get('authorId');

    // Auth check for non-published recipes
    const authUser = await getAuthUser(request);

    const filter = {};

    // Default: only published recipes for non-admin
    if (authUser?.role === 'admin' && status) {
      filter.status = status;
    } else if (authUser?.role === 'admin') {
      // Admin sees all
    } else {
      filter.status = 'published';
    }

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (authorId) filter.authorId = authorId;
    if (search) {
      filter.$text = { $search: search };
    }

    const needsAggregateSort = sort === 'trending' || sort === 'rating';

    let recipes;
    let total;

    if (needsAggregateSort) {
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            likeCount: { $size: { $ifNull: ['$likedBy', []] } },
          },
        },
      ];

      if (sort === 'rating') {
        pipeline.push(
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'recipeId',
              as: '_reviews',
            },
          },
          {
            $addFields: {
              averageRating: { $ifNull: [{ $avg: '$_reviews.rating' }, 0] },
              reviewCount: { $size: '$_reviews' },
            },
          },
          { $project: { _reviews: 0 } },
          { $sort: { averageRating: -1, reviewCount: -1, likeCount: -1, createdAt: -1 } },
        );
      } else {
        pipeline.push({ $sort: { likeCount: -1, createdAt: -1 } });
      }

      pipeline.push(
        { $skip: (page - 1) * limit },
        { $limit: limit },
      );

      [recipes, total] = await Promise.all([
        Recipe.aggregate(pipeline),
        Recipe.countDocuments(filter),
      ]);
    } else {
      // Default sort options for simple query path.
      let sortObj = { createdAt: -1 }; // newest default
      if (sort === 'title') {
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
      { recipes, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
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

  const limit = await rateLimit('write')(request);
  if (!limit.allowed) return rateLimitResponse(cors);

  try {
    await connectDB();
    const authUser = await requireAuth(request);

    if (authUser.status !== 'active') {
      return errors.forbidden('Account must be active to create recipes', cors);
    }

    const body = await request.json();
    const recipeId = `recipe-${Date.now().toString(36)}`;

    const recipe = await Recipe.create({
      _id: recipeId,
      title: sanitizeString(body.title || '', 100),
      description: sanitizeString(body.description || '', 1000),
      category: sanitizeString(body.category || '', 100),
      prepTime: body.prepTime,
      cookTime: body.cookTime,
      servings: body.servings,
      difficulty: body.difficulty,
      ingredients: Array.isArray(body.ingredients)
        ? body.ingredients.map((item) => ({
          name: sanitizeString(item?.name || '', 100),
          quantity: sanitizeString(item?.quantity || '', 50),
          unit: sanitizeString(item?.unit || '', 30),
        }))
        : [],
      instructions: Array.isArray(body.instructions)
        ? body.instructions.map((step) => sanitizeString(step || '', 1000))
        : [],
      images: body.images || [],
      imageUrl: body.images?.[0] || body.imageUrl || null,
      imageAltText: body.title,
      authorId: authUser.userId,
      status: 'pending',
      likedBy: [],
      viewedBy: [],
    });

    return successResponse({ recipe: recipe.toJSON() }, 'Recipe created', 201, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
