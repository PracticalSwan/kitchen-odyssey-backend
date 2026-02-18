// API route for random recipe suggestion - handles GET quality-based random recipe
import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { Recipe, Review } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/recipes/random-suggestion
export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();

    // Quality pool: published, >= 5 likes, >= 1 review
    const qualityPipeline = [
      { $match: { status: 'published' } },
      {
        $addFields: {
          likeCount: { $size: { $ifNull: ['$likedBy', []] } },
        },
      },
      { $match: { likeCount: { $gte: 5 } } },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'recipeId',
          as: '_reviews',
        },
      },
      {
        $addFields: { reviewCount: { $size: '$_reviews' } },
      },
      { $match: { reviewCount: { $gte: 1 } } },
      { $project: { _reviews: 0 } },
      { $sample: { size: 1 } },
    ];

    let [recipe] = await Recipe.aggregate(qualityPipeline);

    // Fallback: any published recipe
    if (!recipe) {
      [recipe] = await Recipe.aggregate([
        { $match: { status: 'published' } },
        { $sample: { size: 1 } },
      ]);
    }

    if (!recipe) {
      return successResponse(null, 'No recipes available', 200, cors);
    }

    return successResponse(recipe, 'Random suggestion', 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
