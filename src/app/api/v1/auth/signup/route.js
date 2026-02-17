import { connectDB } from '@/lib/db.js';
import { successResponse, errorResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { generateAccessToken, generateRefreshToken, setAuthCookies } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit.js';
import { schemas, sanitizeString } from '@/lib/validate.js';
import { User } from '@/models/index.js';
import bcrypt from 'bcryptjs';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  const cors = getCorsHeaders(request);

  const limit = await rateLimit('auth')(request);
  if (!limit.allowed) return rateLimitResponse(cors);

  try {
    await connectDB();
    const body = await request.json();
    const { username, firstName, lastName, email, password, birthday, bio, location, cookingLevel } = body;

    // Validation using schemas
    const validationErrors = [];
    const usernameCheck = schemas.username(username);
    const emailCheck = schemas.email(email);
    const passCheck = schemas.password(password);
    if (!usernameCheck.valid) validationErrors.push(usernameCheck.error);
    if (!firstName?.trim()) validationErrors.push('First name is required');
    if (!lastName?.trim()) validationErrors.push('Last name is required');
    if (!emailCheck.valid) validationErrors.push(emailCheck.error);
    if (!passCheck.valid) validationErrors.push(passCheck.error);

    if (validationErrors.length > 0) {
      return errorResponse('VALIDATION_ERROR', 'Validation failed', 400, validationErrors, cors);
    }

    // Check duplicate email
    const existing = await User.findOne({ email: emailCheck.value });
    if (existing) {
      return errors.conflict('Email already registered', cors);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user-${Date.now().toString(36)}`;

    const user = await User.create({
      _id: userId,
      username: usernameCheck.value,
      firstName: sanitizeString(firstName.trim(), 50),
      lastName: sanitizeString(lastName.trim(), 50),
      email: emailCheck.value,
      passwordHash,
      birthday: birthday || null,
      role: 'user',
      status: 'pending',
      joinedDate: new Date(),
      bio: sanitizeString(bio || '', 500),
      location: sanitizeString(location || '', 100),
      cookingLevel: cookingLevel || 'Beginner',
      favorites: [],
      viewedRecipes: [],
      tokenVersion: 0,
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const response = successResponse(
      { user: user.toJSON() },
      'Account created successfully',
      201,
      cors,
    );

    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
