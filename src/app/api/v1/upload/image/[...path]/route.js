// API route for image deletion - handles DELETE uploaded file removal by admin
import { connectDB } from '@/lib/db.js';
import { requireRole } from '@/lib/auth.js';
import { errors, safeErrorResponse, successResponse } from '@/lib/response.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { deleteFileIfExists, resolveUploadPath } from '@/lib/files.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// DELETE /api/v1/upload/image/:path* - Delete uploaded image by relative storage path
export async function DELETE(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    await requireRole(request, 'admin');

    const { path: pathSegments } = await params;
    const relativePath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
    if (!relativePath || relativePath.includes('..')) {
      return errors.validation('Invalid image path', cors);
    }

    const absolutePath = resolveUploadPath(relativePath);
    if (!absolutePath) {
      return errors.validation('Invalid image path', cors);
    }

    const deleted = await deleteFileIfExists(absolutePath);
    if (!deleted) {
      return errors.notFound('Image not found', cors);
    }

    return successResponse({ deleted: true, path: relativePath }, 'Image deleted', 200, cors);
  } catch (error) {
    return safeErrorResponse(error, cors);
  }
}
