// Health check endpoint
import { connectDB } from '@/lib/db.js';
import { successResponse, errorResponse } from '@/lib/response.js';

export async function GET() {
  try {
    await connectDB();
    return successResponse({ status: 'ok' });
  } catch {
    return errorResponse('SERVICE_UNAVAILABLE', 'Service unavailable', 503);
  }
}
