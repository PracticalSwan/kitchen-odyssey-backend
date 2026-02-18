// API proxy middleware for security headers, CSRF protection, and request validation

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

// Build security headers for all responses
function buildSecurityHeaders() {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

// Parse cookie header into a Map for easy lookup
function parseCookieMap(cookieHeader) {
  const map = new Map();
  if (!cookieHeader) return map;
  cookieHeader.split(';').forEach((segment) => {
    const [rawKey, ...rawValue] = segment.trim().split('=');
    if (!rawKey) return;
    map.set(rawKey, rawValue.join('='));
  });
  return map;
}

// Apply security headers and correlation ID to response
function applyCommonHeaders(response, correlationId) {
  const securityHeaders = buildSecurityHeaders();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  response.headers.set('x-correlation-id', correlationId);
  return response;
}

// Check if HTTP method modifies server state
function isStateChangingMethod(method) {
  return ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
}

// Define paths exempt from CSRF validation (public endpoints)
function isCsrfExemptPath(pathname) {
  if (pathname === '/api/v1/auth/login') return true;
  if (pathname === '/api/v1/auth/signup') return true;
  if (pathname === '/api/v1/auth/refresh') return true;
  if (pathname === '/api/v1/auth/guest-session') return true;
  if (/^\/api\/v1\/recipes\/[^/]+\/view$/.test(pathname)) return true;
  return false;
}

// Main proxy middleware function
export function proxy(request) {
  // Generate or retrieve correlation ID for request tracking
  const requestHeaders = new Headers(request.headers);
  const correlationId = requestHeaders.get('x-correlation-id') || randomUUID();
  requestHeaders.set('x-correlation-id', correlationId);

  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  // Validate state-changing requests
  if (isStateChangingMethod(method)) {
    // Enforce maximum request body size
    const maxBodyBytes = parseInt(process.env.MAX_REQUEST_BODY_BYTES || '1048576', 10);
    const contentLength = parseInt(requestHeaders.get('content-length') || '0', 10);
    if (contentLength > maxBodyBytes) {
      const tooLarge = NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request payload exceeds allowed size',
          },
        },
        { status: 413 },
      );
      return applyCommonHeaders(tooLarge, correlationId);
    }

    // Validate CSRF token for non-exempt paths
    if (!isCsrfExemptPath(pathname)) {
      const cookies = parseCookieMap(requestHeaders.get('cookie'));
      const csrfCookie = cookies.get('ko_csrf');
      const csrfHeader = requestHeaders.get('x-csrf-token');
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        const csrfDenied = NextResponse.json(
          {
            success: false,
            error: {
              code: 'CSRF_TOKEN_INVALID',
              message: 'Invalid CSRF token',
            },
          },
          { status: 403 },
        );
        return applyCommonHeaders(csrfDenied, correlationId);
      }
    }
  }

  // Forward request to API route with headers
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  return applyCommonHeaders(response, correlationId);
}

// Configure middleware to match API routes
export const config = {
  matcher: ['/api/:path*'],
};
