// API route for daily stats - handles GET admin dashboard analytics
import { connectDB } from "@/lib/db.js";
import { successResponse, safeErrorResponse } from "@/lib/response.js";
import { requireRole } from "@/lib/auth.js";
import { getCorsHeaders, handleOptions } from "@/lib/cors.js";
import { DailyStat, User } from "@/models/index.js";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/stats/daily — Admin dashboard aggregated stats
export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    await requireRole(request, "admin");

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 90);

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceKey = since.toISOString().split("T")[0];

    const stats = await DailyStat.find({ _id: { $gte: sinceKey } })
      .sort({ _id: -1 })
      .lean();

    // Today helpers
    const todayKey = new Date().toISOString().split("T")[0];
    const todayStats = stats.find((s) => s._id === todayKey);

    const todayUsers = await User.find({
      joinedDate: { $gte: new Date(todayKey) },
    }).lean();

    const todayActive = await User.find({
      lastActive: { $gte: new Date(todayKey) },
    }).lean();

    return successResponse(
      {
        range: { days, since: sinceKey },
        today: {
          newUsers: todayUsers.length,
          newContributors: todayUsers.filter((u) => u.role === "user").length,
          activeUsers: todayActive.length,
          views: todayStats?.views?.length || 0,
        },
        daily: stats,
      },
      "Daily stats",
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
