// File system utilities for upload path resolution and deletion
import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config } from "@/lib/config.js";

// Normalize upload directory to absolute path
function normalizeUploadRoot() {
  return resolve(process.cwd(), config.image.uploadDir);
}

// Normalize target path for safe file operations
function normalizeTargetPath(targetPath) {
  if (!targetPath || typeof targetPath !== "string") return null;
  return resolve(targetPath);
}

// Resolve relative path within upload directory with security check
export function resolveUploadPath(relativePath) {
  const uploadRoot = normalizeUploadRoot();
  const target = resolve(uploadRoot, relativePath || "");

  // Prevent path traversal attacks
  if (!target.startsWith(uploadRoot)) {
    return null;
  }
  return target;
}

// Convert relative path to public image URL
export function toPublicImageUrl(relativePath) {
  if (!relativePath) return null;
  const safe = relativePath.replace(/\\/g, "/");
  return `${config.image.publicUrlBase}/${safe}`;
}

// Convert public URL back to absolute file system path
export function absolutePathFromPublicUrl(url) {
  if (!url || typeof url !== "string") return null;
  const base = `${config.image.publicUrlBase}/`;
  if (!url.startsWith(base)) return null;
  const relativePath = url.slice(base.length);
  return resolveUploadPath(relativePath);
}

// Delete file if it exists, ignore if not found
export async function deleteFileIfExists(targetPath) {
  const filePath = normalizeTargetPath(targetPath);
  if (!filePath) return false;

  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

// Build full image and thumbnail path objects
export function buildImagePaths(
  baseName,
  extension,
  thumbnailSuffix = "-thumb",
) {
  const fileName = `${baseName}${extension}`;
  const thumbName = `${baseName}${thumbnailSuffix}${extension}`;
  const imageRelativePath = fileName;
  const thumbnailRelativePath = join(
    config.image.thumbnailDir,
    thumbName,
  ).replace(/\\/g, "/");

  return {
    fileName,
    thumbName,
    imageRelativePath,
    thumbnailRelativePath,
    imageAbsolutePath: resolveUploadPath(imageRelativePath),
    thumbnailAbsolutePath: resolveUploadPath(thumbnailRelativePath),
  };
}
