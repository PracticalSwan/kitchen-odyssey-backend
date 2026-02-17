import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config.js', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('parses MONGODB_URI from env', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb+srv://test');
    vi.stubEnv('JWT_SECRET', 'secret');
    vi.stubEnv('ALLOWED_ORIGINS', 'http://localhost:5173');
    const { config } = await import('@/lib/config.js');
    expect(config.mongodb.uri).toBe('mongodb+srv://test');
  });

  it('parses ALLOWED_ORIGINS as CSV', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb+srv://test');
    vi.stubEnv('JWT_SECRET', 'secret');
    vi.stubEnv('ALLOWED_ORIGINS', 'http://a.com, http://b.com');
    const { config } = await import('@/lib/config.js');
    expect(config.cors.allowedOrigins).toContain('http://a.com');
    expect(config.cors.allowedOrigins).toContain('http://b.com');
  });

  it('uses defaults for optional values', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb+srv://test');
    vi.stubEnv('JWT_SECRET', 'secret');
    vi.stubEnv('ALLOWED_ORIGINS', 'http://localhost:5173');
    const { config } = await import('@/lib/config.js');
    expect(config.jwt.accessTokenExpiry).toBe('15m');
    expect(config.jwt.refreshTokenExpiry).toBe('7d');
    expect(config.image.maxSizeBytes).toBe(5242880);
  });
});
