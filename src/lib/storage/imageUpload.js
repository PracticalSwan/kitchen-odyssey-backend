// Image upload processing with validation, resizing, and thumbnail generation
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { extname } from "node:path";
import sharp from "sharp";
import { config } from "@/lib/config.js";
import {
  buildImagePaths,
  resolveUploadPath,
  toPublicImageUrl,
} from "@/lib/files.js";

// Magic byte signatures for image type validation
const MAGIC_BYTES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header, validated further below
};

// Check if buffer starts with specified byte signature
function startsWithBytes(buffer, signature) {
  if (!buffer || buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

// Validate WebP format by checking RIFF and WEBP markers
function isWebp(buffer) {
  if (!startsWithBytes(buffer, MAGIC_BYTES.webp) || buffer.length < 12)
    return false;
  return buffer.toString("ascii", 8, 12) === "WEBP";
}

// Detect MIME type from magic bytes
function detectMimeFromMagic(buffer) {
  if (startsWithBytes(buffer, MAGIC_BYTES.jpeg)) return "image/jpeg";
  if (startsWithBytes(buffer, MAGIC_BYTES.png)) return "image/png";
  if (isWebp(buffer)) return "image/webp";
  return null;
}

// Sanitize file name stem to safe characters
function sanitizeFileStem(input) {
  const raw = `${input || ""}`.toLowerCase();
  const stripped = raw
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return stripped || "image";
}

// Validate and normalize file extension
function sanitizeExtension(fileName) {
  const ext = extname(fileName || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
}

// Ensure upload directories exist with proper permissions
async function ensureUploadDirs() {
  const uploadRoot = resolveUploadPath("");
  const thumbRoot = resolveUploadPath(config.image.thumbnailDir);
  if (!uploadRoot || !thumbRoot) {
    throw new Error("Invalid upload directory configuration");
  }

  await mkdir(uploadRoot, { recursive: true, mode: 0o755 });
  await mkdir(thumbRoot, { recursive: true, mode: 0o755 });
  return { uploadRoot, thumbRoot };
}

// Validate uploaded image file (size, type, dimensions)
export async function parseAndValidateImage(file) {
  if (!file || typeof file === "string") {
    const error = new Error("Image file is required");
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > config.image.maxSizeBytes) {
    const error = new Error(
      `Max size: ${config.image.maxSizeBytes / 1024 / 1024}MB`,
    );
    error.status = 400;
    throw error;
  }

  const detectedMime = detectMimeFromMagic(buffer);
  if (!detectedMime || !config.image.allowedTypes.includes(detectedMime)) {
    const error = new Error(
      `Allowed types: ${config.image.allowedTypes.join(", ")}`,
    );
    error.status = 400;
    throw error;
  }

  // Validate image dimensions to avoid decompression bomb style payloads
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height || width > 10000 || height > 10000) {
    const error = new Error("Invalid image dimensions");
    error.status = 400;
    throw error;
  }

  return {
    buffer,
    detectedMime,
    extension: sanitizeExtension(file.name),
  };
}

// Upload and process image with thumbnail generation
export async function uploadImage({
  file,
  entityPrefix,
  entityId,
  thumbnailSize = 300,
}) {
  await ensureUploadDirs();
  const { buffer, extension } = await parseAndValidateImage(file);

  const stamp = Date.now();
  const safePrefix = sanitizeFileStem(entityPrefix);
  const safeId = sanitizeFileStem(entityId);
  const baseName = `${safePrefix}-${safeId}-${stamp}`;
  const paths = buildImagePaths(baseName, extension);

  if (!paths.imageAbsolutePath || !paths.thumbnailAbsolutePath) {
    throw new Error("Invalid upload path");
  }

  await writeFile(paths.imageAbsolutePath, buffer, { mode: 0o644 });
  await sharp(buffer)
    .resize(thumbnailSize, thumbnailSize, { fit: "cover" })
    .toFile(paths.thumbnailAbsolutePath);
  await chmod(paths.thumbnailAbsolutePath, 0o644);

  return {
    fileName: paths.fileName,
    imageRelativePath: paths.imageRelativePath,
    thumbnailRelativePath: paths.thumbnailRelativePath,
    imageStoragePath: paths.imageAbsolutePath,
    thumbnailStoragePath: paths.thumbnailAbsolutePath,
    imageUrl: toPublicImageUrl(paths.imageRelativePath),
    imageThumbnailUrl: toPublicImageUrl(paths.thumbnailRelativePath),
  };
}
