// Health check endpoint
import { connectDB, getConnectionStatus } from '@/lib/db.js';
import { successResponse, safeErrorResponse } from '@/lib/response.js';

export async function GET() {
  try {
    const startTime = Date.now();
    await connectDB();
    const dbLatency = Date.now() - startTime;

    return successResponse({
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: getConnectionStatus(),
        latencyMs: dbLatency,
      },
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
