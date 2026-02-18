// API route for recipe view tracking - handles POST view recording for analytics
import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { getAuthUser } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { Recipe, DailyStat } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/v1/recipes/:id/view — Record view (public, guest-aware)
export async function POST(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const { id } = await params;

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return errors.notFound('Recipe not found', cors);
    }

    const authUser = await getAuthUser(request);
    const guestId = request.headers.get('x-guest-id');

    // Guest views: return count without recording
    if (!authUser && guestId) {
      return successResponse({ viewCount: recipe.viewedBy?.length || 0 }, null, 200, cors);
    }

    // No viewer at all
    if (!authUser) {
      return successResponse({ viewCount: recipe.viewedBy?.length || 0 }, null, 200, cors);
    }

    const viewerKey = authUser.userId;

    // Record unique view on recipe
    if (!recipe.viewedBy.includes(viewerKey)) {
      recipe.viewedBy.push(viewerKey);
      await recipe.save();
    }

    // Record daily stat view
    const today = new Date().toISOString().split('T')[0];
    await DailyStat.findByIdAndUpdate(
      today,
      {
        $setOnInsert: { newUsers: [], newContributors: [], activeUsers: [] },
        $addToSet: {
          views: { viewerKey, viewerType: 'user', recipeId: id, viewedAt: new Date() },
        },
      },
      { upsert: true },
    );

    return successResponse({ viewCount: recipe.viewedBy.length }, null, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
