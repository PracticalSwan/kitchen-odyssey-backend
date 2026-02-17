// In-memory sliding window rate limiter for Next.js App Router
import { config } from '@/lib/config.js';

const store = new Map();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > config.rateLimit.windowMs) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow Node to exit even if timer is active
  if (cleanupTimer.unref) cleanupTimer.unref();
}

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

const maxByType = {
  auth: () => config.rateLimit.maxAuth,
  write: () => config.rateLimit.maxWrite,
  read: () => config.rateLimit.maxRead,
};

export function rateLimit(type) {
  startCleanup();

  return async function checkLimit(request) {
    const ip = getClientIp(request);
    const key = `${type}:${ip}`;
    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;
    const max = maxByType[type]();

    let entry = store.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 1 };
      store.set(key, entry);
      return { allowed: true };
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  };
}

export function rateLimitResponse(corsHeaders = {}) {
  return Response.json(
    { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Retry-After': '60',
      },
    },
  );
}
