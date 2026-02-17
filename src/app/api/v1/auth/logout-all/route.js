import { connectDB } from '@/lib/db.js';
import { successResponse, safeErrorResponse } from '@/lib/response.js';
import { requireAuth, clearAuthCookies } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { User } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);

    // Increment tokenVersion to invalidate all existing tokens
    await User.findByIdAndUpdate(authUser.userId, { $inc: { tokenVersion: 1 } });

    const response = successResponse(null, 'All sessions invalidated', 200, cors);
    clearAuthCookies(response);
    return response;
  } catch (err) {
    if (err.status === 401) {
      const response = successResponse(null, 'Logged out', 200, cors);
      clearAuthCookies(response);
      return response;
    }
    return safeErrorResponse(err, cors);
  }
}
