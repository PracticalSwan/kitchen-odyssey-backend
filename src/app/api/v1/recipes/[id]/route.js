import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { getAuthUser, requireAuth } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { Recipe, Review, User } from '@/models/index.js';
import { absolutePathFromPublicUrl, deleteFileIfExists } from '@/lib/files.js';
import { sanitizeString } from '@/lib/validate.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/recipes/:id
export async function GET(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const { id } = await params;
    const recipe = await Recipe.findById(id).lean();

    if (!recipe) {
      return errors.notFound('Recipe not found', cors);
    }

    // Non-published recipes: owner or admin only
    if (recipe.status !== 'published') {
      const authUser = await getAuthUser(request);
      if (!authUser || (authUser.userId !== recipe.authorId && authUser.role !== 'admin')) {
        return errors.notFound('Recipe not found', cors);
      }
    }

    return successResponse({ recipe }, null, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// PATCH /api/v1/recipes/:id — Owner or admin
export async function PATCH(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);
    const { id } = await params;

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return errors.notFound('Recipe not found', cors);
    }

    // Ownership check
    if (authUser.userId !== recipe.authorId && authUser.role !== 'admin') {
      return errors.forbidden('Access denied', cors);
    }

    const body = await request.json();
    const allowedFields = [
      'title', 'description', 'category', 'prepTime', 'cookTime',
      'servings', 'difficulty', 'ingredients', 'instructions',
      'images', 'imageUrl', 'imageAltText',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) recipe[field] = body[field];
    }

    // Validate numeric fields
    if (body.prepTime !== undefined) recipe.prepTime = Number.isFinite(Number(body.prepTime)) ? Math.max(0, Number(body.prepTime)) : recipe.prepTime;
    if (body.cookTime !== undefined) recipe.cookTime = Number.isFinite(Number(body.cookTime)) ? Math.max(0, Number(body.cookTime)) : recipe.cookTime;
    if (body.servings !== undefined) recipe.servings = Number.isFinite(Number(body.servings)) ? Math.max(1, Math.round(Number(body.servings))) : recipe.servings;
    // Validate difficulty enum
    if (body.difficulty !== undefined && !['Easy', 'Medium', 'Hard'].includes(body.difficulty)) recipe.difficulty = recipe.difficulty;

    if (typeof recipe.title === 'string') recipe.title = sanitizeString(recipe.title, 100);
    if (typeof recipe.description === 'string') recipe.description = sanitizeString(recipe.description, 1000);
    if (typeof recipe.category === 'string') recipe.category = sanitizeString(recipe.category, 100);
    if (typeof recipe.imageAltText === 'string') recipe.imageAltText = sanitizeString(recipe.imageAltText, 200);

    if (Array.isArray(recipe.ingredients)) {
      recipe.ingredients = recipe.ingredients.map((item) => ({
        name: sanitizeString(item?.name || '', 100),
        quantity: sanitizeString(item?.quantity || '', 50),
        unit: sanitizeString(item?.unit || '', 30),
      }));
    }
    if (Array.isArray(recipe.instructions)) {
      recipe.instructions = recipe.instructions.map((step) => sanitizeString(step || '', 1000));
    }

    // Admin can update status (validated enum)
    if (authUser.role === 'admin' && body.status !== undefined) {
      const validStatuses = ['published', 'pending', 'rejected', 'draft'];
      if (validStatuses.includes(body.status)) {
        recipe.status = body.status;
      }
    }

    await recipe.save();
    return successResponse({ recipe: recipe.toJSON() }, 'Recipe updated', 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// DELETE /api/v1/recipes/:id — Owner or admin, cascade cleanup
export async function DELETE(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);
    const { id } = await params;

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return errors.notFound('Recipe not found', cors);
    }

    if (authUser.userId !== recipe.authorId && authUser.role !== 'admin') {
      return errors.forbidden('Access denied', cors);
    }

    // Cascade: delete reviews and remove from favorites
    await Review.deleteMany({ recipeId: id });
    await User.updateMany(
      { favorites: id },
      { $pull: { favorites: id, viewedRecipes: id } },
    );

    const thumbPath = absolutePathFromPublicUrl(recipe.imageThumbnailUrl);
    await Promise.all([
      deleteFileIfExists(recipe.imageStoragePath),
      deleteFileIfExists(thumbPath),
    ]);

    await Recipe.findByIdAndDelete(id);
    return successResponse(null, 'Recipe deleted', 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
