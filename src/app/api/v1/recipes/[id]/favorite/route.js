// API route for recipe favorite toggle - handles POST add/remove from user favorites
import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { requireActiveUser } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { User } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/v1/recipes/:id/favorite — Toggle favorite (active non-admin only)
export async function POST(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireActiveUser(request);
    const { id } = await params;

    const user = await User.findById(authUser.userId);
    if (!user) {
      return errors.notFound('User not found', cors);
    }

    const idx = user.favorites.indexOf(id);
    if (idx >= 0) {
      user.favorites.splice(idx, 1);
    } else {
      user.favorites.push(id);
    }

    await user.save();

    return successResponse(
      { favorited: user.favorites.includes(id) },
      null,
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
