// API route for guest session - handles POST guest ID issuance for read-only access
import { randomUUID } from 'node:crypto';
import { successResponse } from '@/lib/response.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit.js';

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Handle POST guest session requests
export async function POST(request) {
  const cors = getCorsHeaders(request);

  // Apply rate limiting
  const limit = await rateLimit('auth')(request);
  if (!limit.allowed) return rateLimitResponse(cors);

  // Generate unique guest session ID
  const guestId = `guest-${randomUUID()}`;
  return successResponse(
    { guestId, role: 'guest' },
    'Guest session ready',
    200,
    cors,
  );
}
