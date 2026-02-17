import { describe, it, expect } from 'vitest';
import { createLogger, correlationId } from '@/lib/logger.js';

describe('logger.js', () => {
  describe('createLogger', () => {
    it('creates a logger with info, warn, error methods', () => {
      const log = createLogger('test-context');
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
    });

    it('info outputs structured JSON', () => {
      const log = createLogger('auth');
      const logs = [];
      const origLog = console.log;
      console.log = (msg) => logs.push(msg);
      try {
        log.info('User logged in', { userId: '123' });
      } finally {
        console.log = origLog;
      }
      expect(logs).toHaveLength(1);
      const entry = JSON.parse(logs[0]);
      expect(entry.level).toBe('info');
      expect(entry.context).toBe('auth');
      expect(entry.message).toBe('User logged in');
      expect(entry.userId).toBe('123');
      expect(entry.timestamp).toBeDefined();
    });

    it('error outputs to console.error', () => {
      const log = createLogger('db');
      const logs = [];
      const origError = console.error;
      console.error = (msg) => logs.push(msg);
      try {
        log.error('Connection failed', { code: 'ECONNREFUSED' });
      } finally {
        console.error = origError;
      }
      const entry = JSON.parse(logs[0]);
      expect(entry.level).toBe('error');
      expect(entry.code).toBe('ECONNREFUSED');
    });
  });

  describe('correlationId', () => {
    it('returns header value when present', () => {
      const req = {
        headers: { get: (name) => (name === 'x-correlation-id' ? 'abc-123' : null) },
      };
      expect(correlationId(req)).toBe('abc-123');
    });

    it('generates UUID when header missing', () => {
      const req = {
        headers: { get: () => null },
      };
      const id = correlationId(req);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('handles null request', () => {
      const id = correlationId(null);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
