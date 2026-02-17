import { describe, it, expect } from 'vitest';
import {
  successResponse,
  errorResponse,
  errors,
  safeErrorResponse,
} from '@/lib/response.js';

describe('response.js', () => {
  describe('successResponse', () => {
    it('returns 200 with data and success flag', async () => {
      const res = successResponse({ name: 'Test' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Test');
    });

    it('includes message when provided', async () => {
      const res = successResponse(null, 'Created', 201);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.message).toBe('Created');
    });

    it('applies custom headers', async () => {
      const res = successResponse(null, null, 200, { 'X-Custom': 'yes' });
      expect(res.headers.get('X-Custom')).toBe('yes');
    });
  });

  describe('errorResponse', () => {
    it('returns error envelope with code and message', async () => {
      const res = errorResponse('TEST_ERR', 'Something failed', 422);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TEST_ERR');
      expect(body.error.message).toBe('Something failed');
    });

    it('includes details when provided', async () => {
      const res = errorResponse('V', 'Bad', 400, { field: 'email' });
      const body = await res.json();
      expect(body.error.details.field).toBe('email');
    });
  });

  describe('errors helpers', () => {
    it('validation returns 400', async () => {
      const res = errors.validation('Bad input');
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('unauthorized returns 401', async () => {
      const res = errors.unauthorized();
      expect(res.status).toBe(401);
    });

    it('forbidden returns 403', async () => {
      const res = errors.forbidden('Nope');
      expect(res.status).toBe(403);
    });

    it('notFound returns 404', async () => {
      const res = errors.notFound();
      expect(res.status).toBe(404);
    });

    it('conflict returns 409', async () => {
      const res = errors.conflict();
      expect(res.status).toBe(409);
    });

    it('rateLimited returns 429', async () => {
      const res = errors.rateLimited();
      expect(res.status).toBe(429);
    });

    it('internal returns 500', async () => {
      const res = errors.internal();
      expect(res.status).toBe(500);
    });
  });

  describe('safeErrorResponse', () => {
    it('passes through auth errors with status', async () => {
      const err = new Error('Auth required');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      const res = safeErrorResponse(err);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('handles Mongoose ValidationError', async () => {
      const err = new Error('Validation failed');
      err.name = 'ValidationError';
      const res = safeErrorResponse(err);
      expect(res.status).toBe(400);
    });

    it('handles CastError', async () => {
      const err = new Error('Cast error');
      err.name = 'CastError';
      const res = safeErrorResponse(err);
      expect(res.status).toBe(400);
    });

    it('handles duplicate key error', async () => {
      const err = new Error('Dup');
      err.code = 11000;
      const res = safeErrorResponse(err);
      expect(res.status).toBe(409);
    });

    it('returns 500 for unknown errors', async () => {
      const res = safeErrorResponse(new Error('unknown'));
      expect(res.status).toBe(500);
    });
  });
});
