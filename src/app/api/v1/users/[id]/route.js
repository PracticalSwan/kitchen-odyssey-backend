import { connectDB } from '@/lib/db.js';
import { successResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { getAuthUser, requireAuth } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { User } from '@/models/index.js';
import { absolutePathFromPublicUrl, deleteFileIfExists } from '@/lib/files.js';
import { sanitizeString } from '@/lib/validate.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/v1/users/:id — Self or admin access
export async function GET(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const { id } = await params;
    const authUser = await getAuthUser(request);

    const user = await User.findById(id).lean();
    if (!user) {
      return errors.notFound('User not found', cors);
    }

    const isSelfOrAdmin = authUser && (authUser.userId === id || authUser.role === 'admin');
    if (isSelfOrAdmin) {
      const { passwordHash, __v, ...rest } = user;
      return successResponse({ user: rest }, null, 200, cors);
    }

    // Public-safe profile for recipe author pages.
    const {
      passwordHash,
      email,
      tokenVersion,
      __v,
      ...publicProfile
    } = user;
    return successResponse({ user: publicProfile }, null, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// PATCH /api/v1/users/:id — Profile update with ownership/admin checks
export async function PATCH(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);
    const { id } = await params;

    // Only self or admin can update
    if (authUser.userId !== id && authUser.role !== 'admin') {
      return errors.forbidden('Access denied', cors);
    }

    const body = await request.json();

    // Whitelist updatable fields
    const allowedFields = ['username', 'firstName', 'lastName', 'bio', 'location', 'cookingLevel', 'birthday', 'avatarUrl'];
    const update = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) update[field] = body[field];
    }

    if (typeof update.username === 'string') update.username = sanitizeString(update.username, 50);
    if (typeof update.firstName === 'string') update.firstName = sanitizeString(update.firstName, 50);
    if (typeof update.lastName === 'string') update.lastName = sanitizeString(update.lastName, 50);
    if (typeof update.bio === 'string') update.bio = sanitizeString(update.bio, 500);
    if (typeof update.location === 'string') update.location = sanitizeString(update.location, 100);

    // Admin-only fields
    if (authUser.role === 'admin') {
      if (body.role !== undefined) update.role = body.role;
      if (body.status !== undefined) update.status = body.status;
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!user) {
      return errors.notFound('User not found', cors);
    }

    return successResponse({ user: user.toJSON() }, 'Profile updated', 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}

// DELETE /api/v1/users/:id — Admin only, cascade cleanup
export async function DELETE(request, { params }) {
  const cors = getCorsHeaders(request);

  try {
    await connectDB();
    const authUser = await requireAuth(request);
    if (authUser.role !== 'admin') {
      return errors.forbidden('Admin access required', cors);
    }

    const { id } = await params;
    const user = await User.findById(id);
    if (!user) {
      return errors.notFound('User not found', cors);
    }

    // Import models for cascade cleanup
    const { Recipe, Review, DailyStat, ActivityLog, SearchHistory } = await import('@/models/index.js');

    // Get recipes by this user for cascade cleanup
    const authoredRecipes = await Recipe.find({ authorId: id })
      .select('_id imageStoragePath imageThumbnailUrl')
      .lean();
    const userRecipeIds = authoredRecipes.map((recipe) => recipe._id);

    // Delete user's recipes
    await Recipe.deleteMany({ authorId: id });

    // Delete reviews by this user or on their recipes
    await Review.deleteMany({ $or: [{ userId: id }, { recipeId: { $in: userRecipeIds } }] });

    // Clean up favorites/viewedRecipes referencing deleted recipes
    if (userRecipeIds.length > 0) {
      await User.updateMany(
        {},
        { $pull: { favorites: { $in: userRecipeIds }, viewedRecipes: { $in: userRecipeIds } } },
      );
    }

    // Remove user from daily stats
    await DailyStat.updateMany(
      {},
      {
        $pull: {
          newUsers: id,
          newContributors: id,
          activeUsers: id,
          views: { viewerKey: id },
        },
      },
    );

    // Remove user-owned activity/search documents
    await ActivityLog.deleteMany({ userId: id });
    await SearchHistory.deleteMany({ userId: id });

    // Best-effort cleanup for uploaded images
    const avatarThumbPath = absolutePathFromPublicUrl(user.avatarThumbnailUrl);
    await Promise.all([
      deleteFileIfExists(user.avatarStoragePath),
      deleteFileIfExists(avatarThumbPath),
      ...authoredRecipes.flatMap((recipe) => {
        const recipeThumbPath = absolutePathFromPublicUrl(recipe.imageThumbnailUrl);
        return [
          deleteFileIfExists(recipe.imageStoragePath),
          deleteFileIfExists(recipeThumbPath),
        ];
      }),
    ]);

    await User.findByIdAndDelete(id);

    return successResponse(null, 'User deleted', 200, cors);
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
