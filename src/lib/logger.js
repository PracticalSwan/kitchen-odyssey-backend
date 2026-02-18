// Structured logging utility with context and correlation ID support
import { randomUUID } from 'node:crypto';

// Extract or generate correlation ID for request tracing
export function correlationId(request) {
  return request?.headers?.get('x-correlation-id') || randomUUID();
}

// Create logger instance with context prefix
export function createLogger(context) {
  function log(level, method, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...data,
    };
    method(JSON.stringify(entry));
  }

  return {
    info: (message, data) => log('info', console.log, message, data),
    warn: (message, data) => log('warn', console.warn, message, data),
    error: (message, data) => log('error', console.error, message, data),
  };
}
