// API route for serving uploaded static files - handles GET image serving with caching
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { resolveUploadPath } from "@/lib/files.js";

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// GET /api/v1/uploads/:path* — Serve uploaded static files
export async function GET(request, { params }) {
  const { path: segments } = await params;

  // Sanitize: reject path traversal
  const joined = Array.isArray(segments) ? segments.join("/") : segments;
  if (joined.includes("..") || joined.includes("~")) {
    return new Response("Forbidden", { status: 403 });
  }

  const ext = extname(joined).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) {
    return new Response("Unsupported type", { status: 415 });
  }

  const filePath = resolveUploadPath(joined);
  if (!filePath) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const data = await readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
