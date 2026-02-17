import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindOne = vi.fn();
const mockCompare = vi.fn();
const mockSetAuthCookies = vi.fn();
const mockRateLimitCheck = vi.fn();

vi.mock('@/lib/db.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/cors.js', () => ({
  getCorsHeaders: vi.fn(() => ({})),
  handleOptions: vi.fn(() => new Response(null, { status: 204 })),
}));

vi.mock('@/lib/rateLimit.js', () => ({
  rateLimit: vi.fn(() => mockRateLimitCheck),
  rateLimitResponse: vi.fn(() => Response.json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests' },
  }, { status: 429 })),
}));

vi.mock('@/models/index.js', () => ({
  User: { findOne: mockFindOne },
}));

vi.mock('bcryptjs', () => ({
  default: { compare: mockCompare },
}));

vi.mock('@/lib/auth.js', () => ({
  generateAccessToken: vi.fn(() => 'access-token'),
  generateRefreshToken: vi.fn(() => 'refresh-token'),
  setAuthCookies: mockSetAuthCookies,
}));

const { POST } = await import('@/app/api/v1/auth/login/route.js');

function createLoginRequest(email, password) {
  return new Request('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

describe('auth/login route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitCheck.mockResolvedValue({ allowed: true });
  });

  it('accepts seeded-style short password format and returns invalid credentials for unknown user', async () => {
    mockFindOne.mockResolvedValue(null);

    const response = await POST(createLoginRequest('missing@kitchenodyssey.com', 'admin'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects empty password with validation error', async () => {
    const response = await POST(createLoginRequest('admin@kitchenodyssey.com', ''));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Password is required');
  });

  it('allows login for valid user with short seeded password and sets auth cookies', async () => {
    const userDoc = {
      _id: 'user-1',
      role: 'admin',
      tokenVersion: 0,
      status: 'active',
      lastActive: null,
      passwordHash: 'hashed-password',
      save: vi.fn().mockResolvedValue(undefined),
      toJSON: vi.fn(() => ({
        _id: 'user-1',
        email: 'admin@kitchenodyssey.com',
        role: 'admin',
        status: 'active',
      })),
    };

    mockFindOne.mockResolvedValue(userDoc);
    mockCompare.mockResolvedValue(true);

    const response = await POST(createLoginRequest('admin@kitchenodyssey.com', 'admin'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('admin@kitchenodyssey.com');
    expect(mockSetAuthCookies).toHaveBeenCalledTimes(1);
  });
});
