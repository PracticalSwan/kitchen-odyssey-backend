// JWT token management and authentication middleware utilities
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { connectDB } from './db.js';

// JWT secret validation with minimum length requirement
const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return secret;
};

// Cookie names for authentication tokens
const COOKIE_ACCESS = 'ko_access';
const COOKIE_REFRESH = 'ko_refresh';
const COOKIE_CSRF = 'ko_csrf';

// Generate short-lived JWT access token (15 minutes)
export function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id || user.id, role: user.role, type: 'access', tokenVersion: user.tokenVersion || 0 },
    JWT_SECRET(),
    { expiresIn: '15m' }
  );
}

// Generate long-lived JWT refresh token (7 days)
export function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id || user.id, type: 'refresh', tokenVersion: user.tokenVersion || 0 },
    JWT_SECRET(),
    { expiresIn: '7d' }
  );
}

// Verify and decode JWT token, returns null if invalid
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET());
  } catch {
    return null;
  }
}

// Create standardized authentication error
function authError(message, code = 'UNAUTHORIZED', status = 401) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

// Extract and verify user from request cookies, returns user payload or null
export async function getAuthUser(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_ACCESS)?.value;
    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded) return null;

    await connectDB();
    const { default: User } = await import('../models/User.js');
    const user = await User.findById(decoded.userId).lean();
    if (!user) return null;

    // Verify token version for logout-all support
    if (user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return null;
    }

    return { userId: user._id, role: user.role, status: user.status };
  } catch {
    return null;
  }
}

// Authentication guard - throws error if user not authenticated
export async function requireAuth(request) {
  const user = await getAuthUser(request);
  if (!user) throw authError('Authentication required');
  return user;
}

// Role-based authorization guard - throws error if user lacks required role
export async function requireRole(request, role) {
  const user = await requireAuth(request);
  if (user.role !== role) throw authError('Access denied', 'FORBIDDEN', 403);
  return user;
}

// Active non-admin user guard for user interactions (like, favorite, review)
export async function requireActiveUser(request) {
  const user = await requireAuth(request);
  if (user.status !== 'active') throw authError('Account not active', 'FORBIDDEN', 403);
  if (user.role === 'admin') throw authError('Admin accounts cannot perform this action', 'FORBIDDEN', 403);
  return user;
}

// Set authentication cookies on response (access, refresh, CSRF)
export function setAuthCookies(response, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? ' Secure;' : '';
  const csrfToken = randomUUID();

  response.headers.append('Set-Cookie', `${COOKIE_ACCESS}=${accessToken}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=900`);
  response.headers.append('Set-Cookie', `${COOKIE_REFRESH}=${refreshToken}; HttpOnly;${secure} SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=604800`);
  response.headers.append('Set-Cookie', `${COOKIE_CSRF}=${csrfToken};${secure} SameSite=Lax; Path=/; Max-Age=604800`);

  return response;
}

// Clear all authentication cookies
export function clearAuthCookies(response) {
  response.headers.append('Set-Cookie', `${COOKIE_ACCESS}=; HttpOnly; Path=/; Max-Age=0`);
  response.headers.append('Set-Cookie', `${COOKIE_REFRESH}=; HttpOnly; Path=/api/v1/auth/refresh; Max-Age=0`);
  response.headers.append('Set-Cookie', `${COOKIE_CSRF}=; Path=/; Max-Age=0`);
  return response;
}
