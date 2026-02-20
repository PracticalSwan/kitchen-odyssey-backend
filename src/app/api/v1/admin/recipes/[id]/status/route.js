// API route for admin recipe status - handles PATCH status update for moderation
import { connectDB } from "@/lib/db.js";
import { successResponse, errors, safeErrorResponse } from "@/lib/response.js";
import { requireRole } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { Recipe, User, ActivityLog } from "@/models/index.js";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// PATCH /api/v1/admin/recipes/:id/status — Admin sets recipe status
export async function PATCH(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireRole(request, "admin");
    const { id } = await params;

    const { status } = await request.json();
    const allowed = ["published", "pending", "rejected", "draft"];
    if (!status || !allowed.includes(status)) {
      return errors.validation(
        `status must be one of: ${allowed.join(", ")}`,
        cors,
      );
    }

    const recipe = await Recipe.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!recipe) {
      return errors.notFound("Recipe not found", cors);
    }

    // Log admin activity
    try {
      const admin = await User.findById(authUser.userId, "username").lean();
      const adminName = admin?.username || "Admin";
      const label = status === "published" ? "approved" : status === "rejected" ? "rejected" : `set status to ${status} for`;
      await ActivityLog.create({
        _id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: "admin-recipe",
        message: `${adminName} ${label} "${recipe.title}"`,
        userId: authUser.userId,
        targetId: id,
        metadata: { action: "status-change", status },
      });
    } catch { /* activity logging is non-critical */ }

    return successResponse(recipe, "Recipe status updated", 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
