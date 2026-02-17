import { connectDB } from '@/lib/db.js';
import { successResponse, errorResponse, errors, safeErrorResponse } from '@/lib/response.js';
import { generateAccessToken, generateRefreshToken, setAuthCookies } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit.js';
import { schemas } from '@/lib/validate.js';
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
    const { email, password } = await request.json();

    const emailCheck = schemas.email(email);
    if (!emailCheck.valid) return errorResponse('VALIDATION_ERROR', emailCheck.error, 400, null, cors);

    if (typeof password !== 'string' || password.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'Password is required', 400, null, cors);
    }

    const user = await User.findOne({ email: emailCheck.value });
    if (!user) {
      return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401, null, cors);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401, null, cors);
    }

    // Update status and lastActive on login
    if (user.status === 'active' || user.status === 'inactive') {
      user.status = 'active';
    }
    user.lastActive = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const response = successResponse(
      { user: user.toJSON() },
      'Login successful',
      200,
      cors,
    );

    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    return safeErrorResponse(err, cors);
  }
}
