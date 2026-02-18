// API route for recipe rating - handles GET average rating and count
import { connectDB } from "@/lib/db.js";
import { successResponse, errors, safeErrorResponse } from "@/lib/response.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { Review } from "@/models/index.js";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/recipes/:id/rating — Public average/count
export async function GET(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const { id } = await params;

    const result = await Review.aggregate([
      { $match: { recipeId: id } },
      {
        $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } },
      },
    ]);

    const data = result[0] || { average: 0, count: 0 };
    return successResponse(
      { average: Math.round(data.average * 10) / 10, count: data.count },
      null,
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
