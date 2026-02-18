import { connectDB, getConnectionStats } from '@/lib/db.js';
import { getAuthUser, requireAuth } from '@/lib/auth.js';
import { getCorsHeaders, handleOptions } from '@/lib/cors.js';
import { successResponse, errorResponse } from '@/lib/response.js';
import os from 'os';

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  const cors = getCorsHeaders(request);

  try {
    const authUser = await getAuthUser(request);

    if (authUser?.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Admin access required', 403, null, cors);
    }

    await connectDB();

    const dbStats = getConnectionStats();

    const monitoring = {
      timestamp: new Date().toISOString(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        totalmem: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
        freemem: Math.round(os.freemem() / 1024 / 1024) + ' MB',
        loadavg: os.loadavg(),
      },
      node: {
        version: process.version,
        pid: process.pid,
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
          external: Math.round(process.memoryUsage().external / 1024 / 1024) + ' MB',
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        },
      },
      mongodb: {
        status: dbStats.status,
        host: dbStats.host,
        name: dbStats.name,
        pool: dbStats.pool || {
          totalConnections: 'N/A',
          availableConnections: 'N/A',
        },
      },
    };

    return successResponse(monitoring, null, 200, cors);
  } catch (err) {
    return errorResponse('MONITORING_ERROR', err.message, 500, null, cors);
  }
}
