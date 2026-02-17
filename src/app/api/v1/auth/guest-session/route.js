import { randomUUID } from 'node:crypto';
import { successResponse } from '@/lib/response.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/v1/auth/guest-session - Issue/echo a guest session identifier.
export async function POST(request) {
  const cors = getCorsHeaders(request);

  let guestId = null;
  try {
    const body = await request.json();
    guestId = body?.guestId || null;
  } catch {
    // no-op: empty body is valid
  }

  const resolvedGuestId = guestId || `guest-${randomUUID()}`;
  return successResponse(
    { guestId: resolvedGuestId, role: 'guest' },
    'Guest session ready',
    200,
    cors,
  );
}
