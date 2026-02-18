// API route for token refresh - handles POST access token renewal from refresh token
import { connectDB } from '@/lib/db.js';
import { successResponse, errorResponse, safeErrorResponse } from '@/lib/response.js';
import { verifyToken, generateAccessToken, setAuthCookies } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit.js';
import { User } from '@/models/index.js';
import { cookies } from 'next/headers';

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Handle POST refresh requests
export async function POST(request) {
  const cors = getCorsHeaders(request);

  // Apply rate limiting
  const limit = await rateLimit('auth')(request);
  if (!limit.allowed) return rateLimitResponse(cors);

  try {
    // Connect to database
    await connectDB();
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('ko_refresh')?.value;

    // Validate refresh token exists
    if (!refreshToken) {
      return errorResponse('NO_REFRESH_TOKEN', 'Refresh token not found', 401, null, cors);
    }

    // Verify refresh token validity
    const payload = verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return errorResponse('INVALID_TOKEN', 'Invalid refresh token', 401, null, cors);
    }

    // Fetch user from database
    const user = await User.findById(payload.userId);
    if (!user) {
      return errorResponse('USER_NOT_FOUND', 'User not found', 401, null, cors);
    }

    // Check tokenVersion to detect logout-all invalidation
    if (user.tokenVersion !== payload.tokenVersion) {
      return errorResponse('TOKEN_REVOKED', 'Token has been revoked', 401, null, cors);
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user);
    const response = successResponse(
      { user: user.toJSON() },
      'Token refreshed',
      200,
      cors,
    );

    // Set cookies and return response
    setAuthCookies(response, newAccessToken, refreshToken);
    return response;
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
