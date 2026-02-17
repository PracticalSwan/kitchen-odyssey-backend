import { connectDB } from '@/lib/db.js';
import { successResponse, errorResponse, safeErrorResponse } from '@/lib/response.js';
import { verifyToken, generateAccessToken, setAuthCookies } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit.js';
import { User } from '@/models/index.js';
import { cookies } from 'next/headers';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  const cors = getCorsHeaders(request);

  const limit = await rateLimit('auth')(request);
  if (!limit.allowed) return rateLimitResponse(cors);

  try {
    await connectDB();
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('ko_refresh')?.value;

    if (!refreshToken) {
      return errorResponse('NO_REFRESH_TOKEN', 'Refresh token not found', 401, null, cors);
    }

    const payload = verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return errorResponse('INVALID_TOKEN', 'Invalid refresh token', 401, null, cors);
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return errorResponse('USER_NOT_FOUND', 'User not found', 401, null, cors);
    }

    // Check tokenVersion (logout-all invalidation)
    if (user.tokenVersion !== payload.tokenVersion) {
      return errorResponse('TOKEN_REVOKED', 'Token has been revoked', 401, null, cors);
    }

    const newAccessToken = generateAccessToken(user);
    const response = successResponse(
      { user: user.toJSON() },
      'Token refreshed',
      200,
      cors,
    );

    setAuthCookies(response, newAccessToken, refreshToken);
    return response;
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
