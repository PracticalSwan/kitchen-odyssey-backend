import { connectDB } from '@/lib/db.js';
import { successResponse, safeErrorResponse } from '@/lib/response.js';
import { requireRole, requireAuth } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { sanitizeString } from '@/lib/validate.js';
import { ActivityLog } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/activity — Admin: paginated activity feed
export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    await requireRole(request, 'admin');

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ActivityLog.find().sort({ time: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(),
    ]);

    return successResponse(
      { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      'Activity log',
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// POST /api/v1/activity — Record activity entry (auth required)
export async function POST(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);

    const body = await request.json();
    const type = sanitizeString(body.type || '', 80);
    const message = sanitizeString(body.message || '', 500);
    const targetId = body.targetId;
    const metadata = body.metadata;

    if (!type || !message) {
      const { errors: e } = await import('@/lib/response.js');
      return e.validation('type and message are required', cors);
    }

    const entry = await ActivityLog.create({
      _id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      message,
      userId: authUser.userId,
      targetId: targetId || null,
      metadata: metadata || {},
    });

    return successResponse(entry, 'Activity recorded', 201, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
