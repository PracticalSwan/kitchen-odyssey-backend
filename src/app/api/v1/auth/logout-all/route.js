// API route for logout all sessions - handles POST token invalidation via tokenVersion
import { connectDB } from "@/lib/db.js";
import { successResponse, safeErrorResponse } from "@/lib/response.js";
import { requireAuth, clearAuthCookies } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { User } from "@/models/index.js";

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Handle POST logout-all requests
export async function POST(request) {
  const cors = getCorsHeaders(request);

  try {
    // Connect to database and authenticate user
    await connectDB();
    const authUser = await requireAuth(request);

    // Increment tokenVersion to invalidate all existing tokens
    await User.findByIdAndUpdate(authUser.userId, {
      $inc: { tokenVersion: 1 },
    });

    // Clear authentication cookies
    const response = successResponse(
      null,
      "All sessions invalidated",
      200,
      cors,
    );
    clearAuthCookies(response);
    return response;
  } catch (err) {
    // Handle expired tokens gracefully by clearing cookies
    if (err.status === 401) {
      const response = successResponse(null, "Logged out", 200, cors);
      clearAuthCookies(response);
      return response;
    }
    return safeErrorResponse(err, cors);
  }
}
