import { join } from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only backend — no UI pages served
  reactCompiler: true,

  // Allow cross-origin requests from the Vite frontend
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // Serve uploaded images from /uploads path
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/v1/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
