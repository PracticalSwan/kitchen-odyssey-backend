import { randomUUID } from 'node:crypto';
import { successResponse } from '@/lib/response.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/v1/auth/guest-session - Issue a new guest session identifier.
export async function POST(request) {
  const cors = getCorsHeaders(request);

  const limit = await rateLimit('auth')(request);
  if (!limit.allowed) return rateLimitResponse(cors);

  // Always generate server-side ID to prevent session fixation
  const guestId = `guest-${randomUUID()}`;
  return successResponse(
    { guestId, role: 'guest' },
    'Guest session ready',
    200,
    cors,
  );
}
