// CORS helper for API route handlers
import { config } from './config.js';

export function getCorsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowedOrigins = config.cors.allowedOrigins;

  const isAllowed = Boolean(origin) && (
    allowedOrigins.includes('*') || allowedOrigins.includes(origin)
  );

  const headers = {
    'Access-Control-Allow-Credentials': isAllowed ? 'true' : 'false',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-ID, X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (isAllowed) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

// OPTIONS preflight handler for route files
export function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

// Wrap response with CORS headers
export function corsResponse(body, init = {}, request) {
  const headers = { ...getCorsHeaders(request), ...(init.headers || {}) };
  return Response.json(body, { ...init, headers });
}
