// API route for user logout - handles POST session termination and cookie clearing
import { connectDB } from "@/lib/db.js";
import { successResponse, safeErrorResponse } from "@/lib/response.js";
import { requireAuth, clearAuthCookies } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { User } from "@/models/index.js";

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Handle POST logout requests
export async function POST(request) {
  const cors = getCorsHeaders(request);

  try {
    // Connect to database and authenticate user
    await connectDB();
    const authUser = await requireAuth(request);

    // Update user status to inactive
    const user = await User.findById(authUser.userId);
    if (user && (user.status === "active" || user.status === "inactive")) {
      user.status = "inactive";
      await user.save();
    }

    // Clear authentication cookies
    const response = successResponse(
      null,
      "Logged out successfully",
      200,
      cors,
    );
    clearAuthCookies(response, request);
    return response;
  } catch (err) {
    // Handle expired tokens gracefully by clearing cookies
    if (err.status === 401) {
      const response = successResponse(null, "Logged out", 200, cors);
      clearAuthCookies(response, request);
      return response;
    }
    return safeErrorResponse(err, cors);
  }
}
