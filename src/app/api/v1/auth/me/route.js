import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { requireAuth } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { User } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);

    const user = await User.findById(authUser.userId);
    if (!user) {
      return errors.notFound('User not found', cors);
    }

    return successResponse({ user: user.toJSON() }, null, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
