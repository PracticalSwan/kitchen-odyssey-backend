// API route for admin recipe status - handles PATCH status update for moderation
import { connectDB } from "@/lib/db.js";
import { successResponse, errors, safeErrorResponse } from "@/lib/response.js";
import { requireRole } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { Recipe } from "@/models/index.js";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// PATCH /api/v1/admin/recipes/:id/status — Admin sets recipe status
export async function PATCH(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    await requireRole(request, "admin");
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

    return successResponse(recipe, "Recipe status updated", 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
