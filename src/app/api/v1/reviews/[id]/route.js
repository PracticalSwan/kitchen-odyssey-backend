import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { requireAuth } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { Review } from '@/models/index.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// DELETE /api/v1/reviews/:id — Author or admin
export async function DELETE(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);
    const { id } = await params;

    const review = await Review.findById(id);
    if (!review) {
      return errors.notFound('Review not found', cors);
    }

    if (authUser.userId !== review.userId && authUser.role !== 'admin') {
      return errors.forbidden('Access denied', cors);
    }

    await Review.findByIdAndDelete(id);
    return successResponse(null, 'Review deleted', 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
