import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { requireActiveUser } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { Recipe } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/v1/recipes/:id/like — Toggle like (active non-admin only)
export async function POST(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireActiveUser(request);
    const { id } = await params;

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return errors.notFound('Recipe not found', cors);
    }

    const idx = recipe.likedBy.indexOf(authUser.userId);
    if (idx >= 0) {
      recipe.likedBy.splice(idx, 1);
    } else {
      recipe.likedBy.push(authUser.userId);
    }

    await recipe.save();

    return successResponse(
      { liked: recipe.likedBy.includes(authUser.userId), count: recipe.likedBy.length },
      null,
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
