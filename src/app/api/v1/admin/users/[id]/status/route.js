// API route for admin user status - handles PATCH status update for moderation
import { connectDB } from "@/lib/db.js";
import { successResponse, errors, safeErrorResponse } from "@/lib/response.js";
import { requireRole } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { User, ActivityLog } from "@/models/index.js";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// PATCH /api/v1/admin/users/:id/status — Admin sets user status
export async function PATCH(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireRole(request, "admin");
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

    // Log admin activity
    try {
      const admin = await User.findById(authUser.userId, "username").lean();
      const adminName = admin?.username || "Admin";
      const label = status === "active" ? "approved" : status === "suspended" ? "suspended" : `set status to ${status} for`;
      await ActivityLog.create({
        _id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: "admin-user",
        message: `${adminName} ${label} ${user.username}`,
        userId: authUser.userId,
        targetId: id,
        metadata: { action: "status-change", status },
      });
    } catch { /* activity logging is non-critical */ }

    return successResponse(user, "User status updated", 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
