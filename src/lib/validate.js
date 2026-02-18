// Input validation schemas and HTML sanitization utilities

// Regular expression to detect HTML tags for XSS prevention
const HTML_TAG_RE = /<[^>]*>/g;

// Remove HTML tags and trim string to prevent XSS attacks
export function sanitizeString(str, maxLength = 5000) {
  if (typeof str !== 'string') return '';
  return str.replace(HTML_TAG_RE, '').trim().slice(0, maxLength);
}

// Recursively sanitize query objects by removing MongoDB operators
export function sanitizeQuery(obj) {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeQuery);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    clean[key] = typeof value === 'object' ? sanitizeQuery(value) : value;
  }
  return clean;
}

// Return successful validation result
function ok(value) {
  return { valid: true, value };
}

// Return failed validation result
function fail(error) {
  return { valid: false, error };
}

// Validate and sanitize required string fields
function validateRequiredSanitizedString(val, requiredMessage, emptyMessage, maxLength) {
  if (typeof val !== 'string') return fail(requiredMessage);
  const v = sanitizeString(val, maxLength);
  if (v.length < 1) return fail(emptyMessage);
  return ok(v);
}

// Regular expressions for email and username validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{2,30}$/;

// Validation schemas for common input types
export const schemas = {
  email(val) {
    if (typeof val !== 'string') return fail('Email is required');
    const v = val.trim().toLowerCase();
    if (!EMAIL_RE.test(v)) return fail('Invalid email format');
    return ok(v);
  },

  username(val) {
    if (typeof val !== 'string') return fail('Username is required');
    const v = val.trim();
    if (!USERNAME_RE.test(v)) return fail('Username must be 2-30 characters (letters, numbers, underscores)');
    return ok(v);
  },

  password(val) {
    if (typeof val !== 'string') return fail('Password is required');
    if (val.length < 8) return fail('Password must be at least 8 characters');
    if (!/[A-Z]/.test(val)) return fail('Password must include at least one uppercase letter');
    if (!/[0-9]/.test(val)) return fail('Password must include at least one number');
    return ok(val);
  },

  recipeTitle(val) {
    return validateRequiredSanitizedString(val, 'Title is required', 'Title cannot be empty', 200);
  },

  comment(val) {
    return validateRequiredSanitizedString(val, 'Comment is required', 'Comment cannot be empty', 2000);
  },

  searchQuery(val) {
    return validateRequiredSanitizedString(
      val,
      'Search query is required',
      'Search query cannot be empty',
      200
    );
  },
};
