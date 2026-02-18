// API route for user avatar upload - handles POST avatar image and thumbnail storage
import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { requireActiveUser } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { User } from '@/models/index.js';
import { uploadImage } from '@/lib/storage/imageUpload.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/v1/upload/user-avatar — Upload user avatar + thumbnail
export async function POST(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireActiveUser(request);

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file || typeof file === 'string') {
      return errors.validation('avatar file is required', cors);
    }

    const uploaded = await uploadImage({
      file,
      entityPrefix: 'avatar',
      entityId: authUser.userId,
      thumbnailSize: 150,
    });

    await User.findByIdAndUpdate(authUser.userId, {
      avatarUrl: uploaded.imageUrl,
      avatarStoragePath: uploaded.imageStoragePath,
      avatarThumbnailUrl: uploaded.imageThumbnailUrl,
    });

    return successResponse(
      {
        avatarUrl: uploaded.imageUrl,
        avatarThumbnailUrl: uploaded.imageThumbnailUrl,
        fileName: uploaded.fileName,
        avatarStoragePath: uploaded.imageStoragePath,
      },
      'Avatar uploaded',
      201,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
