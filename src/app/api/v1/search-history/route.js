// API route for search history - handles GET, POST, and DELETE user search queries
import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { requireAuth, getAuthUser } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { sanitizeString } from '@/lib/validate.js';
import { SearchHistory } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/search-history — Get current user's search history
export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);

    const items = await SearchHistory.find({ userId: authUser.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return successResponse(items, 'Search history', 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// POST /api/v1/search-history — Add search query (deduplicates)
export async function POST(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);

    const { query } = await request.json();
    const trimmed = sanitizeString(query || '', 200);
    if (!trimmed) {
      return errors.validation('query is required', cors);
    }

    // Remove older duplicate by same user with same query
    await SearchHistory.deleteMany({ userId: authUser.userId, query: trimmed });

    const entry = await SearchHistory.create({
      _id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId: authUser.userId,
      query: trimmed,
    });

    // Enforce 10-item cap per user
    const count = await SearchHistory.countDocuments({ userId: authUser.userId });
    if (count > 10) {
      const oldest = await SearchHistory.find({ userId: authUser.userId })
        .sort({ createdAt: 1 })
        .limit(count - 10)
        .select('_id');
      await SearchHistory.deleteMany({ _id: { $in: oldest.map(o => o._id) } });
    }

    return successResponse(entry, 'Search recorded', 201, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// DELETE /api/v1/search-history — Clear current user's search history
export async function DELETE(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);

    await SearchHistory.deleteMany({ userId: authUser.userId });
    return successResponse(null, 'Search history cleared', 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
