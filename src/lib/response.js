// Standardized API response and error envelope utilities

export function successResponse(data, message = null, status = 200, headers = {}) {
  const body = { success: true, data };
  if (message) body.message = message;
  return Response.json(body, { status, headers });
}

export function errorResponse(code, message, status = 400, details = null, headers = {}) {
  const body = {
    success: false,
    error: { code, message },
  };
  if (details) body.error.details = details;
  return Response.json(body, { status, headers });
}

// Common error helpers — all accept optional headers as last arg
export const errors = {
  validation: (message, details, headers) => errorResponse('VALIDATION_ERROR', message, 400, details, headers),
  unauthorized: (message = 'Authentication required', headers) => errorResponse('UNAUTHORIZED', message, 401, null, headers),
  forbidden: (message = 'Access denied', headers) => errorResponse('FORBIDDEN', message, 403, null, headers),
  notFound: (message = 'Resource not found', headers) => errorResponse('NOT_FOUND', message, 404, null, headers),
  conflict: (message = 'Resource conflict', headers) => errorResponse('CONFLICT', message, 409, null, headers),
  rateLimited: (message = 'Too many requests', headers) => errorResponse('RATE_LIMITED', message, 429, null, headers),
  internal: (message = 'Internal server error', headers) => errorResponse('INTERNAL_ERROR', message, 500, null, headers),
};

// Secure error handler — hides stack traces and internal details
export function safeErrorResponse(error, headers = {}) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[API Error]', error);
  }

  // Pass through errors thrown by auth middleware with status codes
  if (error.status) {
    return errorResponse(error.code || 'ERROR', error.message, error.status, null, headers);
  }

  if (error.name === 'ValidationError') {
    return errors.validation('Validation failed', null, headers);
  }
  if (error.name === 'CastError') {
    return errors.validation('Invalid ID format', null, headers);
  }
  if (error.code === 11000) {
    return errors.conflict('Duplicate entry', headers);
  }

  return errors.internal('Internal server error', headers);
}
