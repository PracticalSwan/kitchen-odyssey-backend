// API route for current user - handles GET retrieval of authenticated user profile
import { connectDB } from "@/lib/db.js";
import { successResponse, errors, safeErrorResponse } from "@/lib/response.js";
import { requireAuth } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { User } from "@/models/index.js";

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Handle GET current user requests
export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    // Connect to database and authenticate user
    await connectDB();
    const authUser = await requireAuth(request);

    // Fetch user profile
    const user = await User.findById(authUser.userId);
    if (!user) {
      return errors.notFound("User not found", cors);
    }

    // Return user profile
    return successResponse({ user: user.toJSON() }, null, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
