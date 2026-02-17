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

    // Set user to inactive on logout
    const user = await User.findById(authUser.userId);
    if (user && (user.status === 'active' || user.status === 'inactive')) {
      user.status = 'inactive';
      await user.save();
    }

    const response = successResponse(null, 'Logged out successfully', 200, cors);
    clearAuthCookies(response);
    return response;
  } catch (err) {
    // Even if auth fails (expired token), still clear cookies
    if (err.status === 401) {
      const response = successResponse(null, 'Logged out', 200, cors);
      clearAuthCookies(response);
      return response;
    }
    return safeErrorResponse(err, cors);
  }
}
