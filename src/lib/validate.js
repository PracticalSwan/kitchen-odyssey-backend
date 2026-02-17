// Input validation and sanitization utilities

const HTML_TAG_RE = /<[^>]*>/g;

export function sanitizeString(str, maxLength = 5000) {
  if (typeof str !== 'string') return '';
  return str.replace(HTML_TAG_RE, '').trim().slice(0, maxLength);
}

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

function ok(value) {
  return { valid: true, value };
}

function fail(error) {
  return { valid: false, error };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{2,30}$/;

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
    if (val.length < 4) return fail('Password must be at least 4 characters');
    return ok(val);
  },

  recipeTitle(val) {
    if (typeof val !== 'string') return fail('Title is required');
    const v = sanitizeString(val, 200);
    if (v.length < 1) return fail('Title cannot be empty');
    return ok(v);
  },

  comment(val) {
    if (typeof val !== 'string') return fail('Comment is required');
    const v = sanitizeString(val, 2000);
    if (v.length < 1) return fail('Comment cannot be empty');
    return ok(v);
  },

  searchQuery(val) {
    if (typeof val !== 'string') return fail('Search query is required');
    const v = sanitizeString(val, 200);
    if (v.length < 1) return fail('Search query cannot be empty');
    return ok(v);
  },
};
