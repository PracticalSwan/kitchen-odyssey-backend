import { connectDB } from '@/lib/db.js';
import { successResponse, safeErrorResponse } from '@/lib/response.js';
import { getAuthUser } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { sanitizeString } from '@/lib/validate.js';
import { User } from '@/models/index.js';

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/users - Admin list or public-safe user directory
export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await getAuthUser(request);
    const isAdmin = authUser?.role === 'admin';

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const search = sanitizeString(searchParams.get('search') || '', 120);

    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { username: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    if (!isAdmin) {
      filter.status = { $ne: 'suspended' };
    }

    const query = User.find(filter)
      .sort({ joinedDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    if (!isAdmin) {
      query.select('_id username firstName lastName role status joinedDate avatarUrl avatarThumbnailUrl cookingLevel bio location favorites');
    }

    const [users, total] = await Promise.all([query.lean(), User.countDocuments(filter)]);

    const safeUsers = isAdmin
      ? users.map(({ passwordHash, __v, ...rest }) => rest)
      : users.map(({ __v, ...rest }) => rest);

    return successResponse(
      { users: safeUsers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      null,
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
