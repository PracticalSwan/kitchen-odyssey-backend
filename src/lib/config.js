// Environment configuration with validation
const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'ALLOWED_ORIGINS'];

export function validateRequiredEnv(options = {}) {
  const skipDuringBuild = options.skipDuringBuild !== false;
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  if (skipDuringBuild && isBuildPhase) {
    return;
  }

  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export const config = {
  mongodb: {
    uri: process.env.MONGODB_URI,
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 2,
    serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },
  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxAuth: parseInt(process.env.RATE_LIMIT_MAX_AUTH) || 20,
    maxWrite: parseInt(process.env.RATE_LIMIT_MAX_WRITE) || 50,
    maxRead: parseInt(process.env.RATE_LIMIT_MAX_READ) || 100,
  },
  image: {
    uploadDir: process.env.IMAGE_UPLOAD_DIR || './uploads',
    publicUrlBase: process.env.IMAGE_PUBLIC_URL_BASE || 'http://localhost:3000/uploads',
    maxSizeBytes: parseInt(process.env.IMAGE_MAX_SIZE_BYTES) || 5242880,
    allowedTypes: (process.env.IMAGE_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp').split(','),
    thumbnailDir: process.env.IMAGE_THUMBNAIL_DIR || 'thumbnails',
  },
  env: process.env.NODE_ENV || 'development',
};
