// Cached MongoDB connection utility with pooling and monitoring
import mongoose from 'mongoose';

let cached = global.__mongooseConnection;

if (!cached) {
  cached = global.__mongooseConnection = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) {
    // Ensure connection is still alive
    if (mongoose.connection.readyState === 1) {
      return cached.conn;
    }

    cached.conn = null;
  }

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI environment variable is not set');

    const opts = {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 5,
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 1,
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000,
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS) || 45000,
      connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS) || 10000,
      // Enable serverless deployment optimizations
      maxIdleTimeMS: 30000,
    };

    cached.promise = mongoose.connect(uri, opts);

    cached.promise
      .then(() => {
        console.log(`✓ MongoDB connected (pool: ${opts.maxPoolSize})`);
        mongoose.connection.on('error', (err) => {
          console.error('MongoDB connection error:', err);
        });
        mongoose.connection.on('disconnected', () => {
          console.warn('MongoDB disconnected');
          cached.conn = null;
        });
      })
      .catch((err) => {
        console.error('MongoDB connection failed:', err);
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw err;
  }
}

export function getConnectionStatus() {
  const state = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  return states[state] || 'unknown';
}

export function getConnectionStats() {
  if (!mongoose.connection) {
    return { status: 'not initialized', pool: null };
  }

  return {
    status: getConnectionStatus(),
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    pool: mongoose.connection.client?.topology?.s?.pool?.stats || null,
  };
}

// Graceful shutdown handler
export async function closeDB() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
    cached.conn = null;
    cached.promise = null;
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => closeDB().catch(console.error));
  process.on('SIGINT', () => closeDB().catch(console.error));
}
