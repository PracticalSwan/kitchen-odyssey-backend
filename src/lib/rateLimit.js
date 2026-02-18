// In-memory sliding window rate limiter for API endpoint protection
import { config } from '@/lib/config.js';

// In-memory store for rate limit entries
const store = new Map();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer = null;

// Start periodic cleanup of expired rate limit entries
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

// Extract client IP from request headers
function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

// Rate limit thresholds by operation type
const maxByType = {
  auth: () => config.rateLimit.maxAuth,
  write: () => config.rateLimit.maxWrite,
  read: () => config.rateLimit.maxRead,
};

// Create rate limiter middleware for specified operation type
export function rateLimit(type) {
  startCleanup();

  return async function checkLimit(request) {
    const ip = getClientIp(request);
    const key = `${type}:${ip}`;
    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;
    const max = maxByType[type]();

    let entry = store.get(key);

    // Reset window if expired
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 1 };
      store.set(key, entry);
      return { allowed: true };
    }

    // Increment request count
    entry.count += 1;

    // Check if limit exceeded
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  };
}

// Generate rate limit exceeded response
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
