// API route for recipe image upload - handles POST image file and thumbnail storage
import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { requireActiveUser } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { Recipe } from '@/models/index.js';
import { uploadImage } from '@/lib/storage/imageUpload.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/v1/upload/recipe-image — Upload recipe image + thumbnail
export async function POST(request) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireActiveUser(request);

    const formData = await request.formData();
    const file = formData.get('image');
    const recipeId = formData.get('recipeId');

    if (!file || typeof file === 'string') {
      return errors.validation('image file is required', cors);
    }
    if (!recipeId) {
      return errors.validation('recipeId is required', cors);
    }

    // Verify recipe ownership
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) return errors.notFound('Recipe not found', cors);
    if (recipe.authorId !== authUser.userId && authUser.role !== 'admin') {
      return errors.forbidden('Not the recipe owner', cors);
    }

    const uploaded = await uploadImage({
      file,
      entityPrefix: 'recipe',
      entityId: recipeId,
      thumbnailSize: 300,
    });

    // Update recipe
    recipe.imageUrl = uploaded.imageUrl;
    recipe.imageStoragePath = uploaded.imageStoragePath;
    recipe.imageThumbnailUrl = uploaded.imageThumbnailUrl;
    await recipe.save();

    return successResponse(
      {
        imageUrl: uploaded.imageUrl,
        imageThumbnailUrl: uploaded.imageThumbnailUrl,
        fileName: uploaded.fileName,
        imageStoragePath: uploaded.imageStoragePath,
      },
      'Recipe image uploaded',
      201,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
