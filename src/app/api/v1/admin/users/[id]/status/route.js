// API route for admin user status - handles PATCH status update for moderation
import { connectDB } from "@/lib/db.js";
import { successResponse, errors, safeErrorResponse } from "@/lib/response.js";
import { requireRole } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { User } from "@/models/index.js";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// PATCH /api/v1/admin/users/:id/status — Admin sets user status
export async function PATCH(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    await requireRole(request, "admin");
    const { id } = await params;

    const { status } = await request.json();
    const allowed = ["active", "inactive", "suspended", "pending"];
    if (!status || !allowed.includes(status)) {
      return errors.validation(
        `status must be one of: ${allowed.join(", ")}`,
        cors,
      );
    }

    const user = await User.findByIdAndUpdate(id, { status }, { new: true });
    if (!user) {
      return errors.notFound("User not found", cors);
    }

    return successResponse(user, "User status updated", 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
