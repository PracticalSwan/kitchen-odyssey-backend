// Standardized API response formatting and error handling utilities

// Create success response with optional message
export function successResponse(
  data,
  message = null,
  status = 200,
  headers = {},
) {
  const body = { success: true, data };
  if (message) body.message = message;
  return Response.json(body, { status, headers });
}

// Create error response with code, message, and optional details
export function errorResponse(
  code,
  message,
  status = 400,
  details = null,
  headers = {},
) {
  const body = {
    success: false,
    error: { code, message },
  };
  if (details) body.error.details = details;
  return Response.json(body, { status, headers });
}

// Detect if object is CORS headers by checking for known header keys
function isLikelyHeaders(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.some((key) => {
    const lower = key.toLowerCase();
    return lower.startsWith("access-control-") || lower === "vary";
  });
}

// Common error helpers - all accept optional headers as last argument
export const errors = {
  validation: (message, detailsOrHeaders = null, maybeHeaders = {}) => {
    if (
      isLikelyHeaders(detailsOrHeaders) &&
      (!maybeHeaders || Object.keys(maybeHeaders).length === 0)
    ) {
      return errorResponse(
        "VALIDATION_ERROR",
        message,
        400,
        null,
        detailsOrHeaders,
      );
    }
    return errorResponse(
      "VALIDATION_ERROR",
      message,
      400,
      detailsOrHeaders,
      maybeHeaders,
    );
  },
  unauthorized: (message = "Authentication required", headers) =>
    errorResponse("UNAUTHORIZED", message, 401, null, headers),
  forbidden: (message = "Access denied", headers) =>
    errorResponse("FORBIDDEN", message, 403, null, headers),
  notFound: (message = "Resource not found", headers) =>
    errorResponse("NOT_FOUND", message, 404, null, headers),
  conflict: (message = "Resource conflict", headers) =>
    errorResponse("CONFLICT", message, 409, null, headers),
  rateLimited: (message = "Too many requests", headers) =>
    errorResponse("RATE_LIMITED", message, 429, null, headers),
  internal: (message = "Internal server error", headers) =>
    errorResponse("INTERNAL_ERROR", message, 500, null, headers),
};

// Secure error handler - hides stack traces and internal details in production
export function safeErrorResponse(error, headers = {}) {
  if (process.env.NODE_ENV === "development") {
    console.error("[API Error]", error);
  }

  // Pass through errors thrown by auth middleware with status codes
  if (error.status) {
    return errorResponse(
      error.code || "ERROR",
      error.message,
      error.status,
      null,
      headers,
    );
  }

  if (error.name === "ValidationError") {
    return errors.validation("Validation failed", null, headers);
  }
  if (error.name === "CastError") {
    return errors.validation("Invalid ID format", null, headers);
  }
  if (error.code === 11000) {
    return errors.conflict("Duplicate entry", headers);
  }

  return errors.internal("Internal server error", headers);
}
