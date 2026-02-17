import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { requireActiveUser } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit.js';
import { sanitizeString } from '@/lib/validate.js';
import { Recipe, Review } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/recipes/:id/reviews — Public, paginated
export async function GET(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const recipe = await Recipe.findById(id).lean();
    if (!recipe) {
      return errors.notFound('Recipe not found', cors);
    }

    const [reviews, total] = await Promise.all([
      Review.find({ recipeId: id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments({ recipeId: id }),
    ]);

    return successResponse(
      { reviews, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      null,
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// POST /api/v1/recipes/:id/reviews — Add review (active non-admin)
export async function POST(request, { params }) {
  const cors = getCorsHeaders(request);

  const limit = await rateLimit('write')(request);
  if (!limit.allowed) return rateLimitResponse(cors);

  try {
    await connectDB();
    const authUser = await requireActiveUser(request);
    const { id } = await params;

    const recipe = await Recipe.findById(id).lean();
    if (!recipe) {
      return errors.notFound('Recipe not found', cors);
    }

    const body = await request.json();
    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return errors.validation('Rating must be between 1 and 5', null, cors);
    }

    // Upsert: one review per user per recipe
    const reviewId = `review-${Date.now()}`;
    const review = await Review.findOneAndUpdate(
      { recipeId: id, userId: authUser.userId },
      {
        $setOnInsert: { _id: reviewId },
        $set: { rating, comment: sanitizeString(comment || '', 2000) },
      },
      { upsert: true, new: true, runValidators: true },
    );

    return successResponse({ review: review.toJSON() }, 'Review saved', 201, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
