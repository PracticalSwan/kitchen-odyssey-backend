import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { config } from '@/lib/config.js';

function normalizeUploadRoot() {
  return resolve(process.cwd(), config.image.uploadDir);
}

function normalizeTargetPath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return null;
  return resolve(targetPath);
}

export function resolveUploadPath(relativePath) {
  const uploadRoot = normalizeUploadRoot();
  const target = resolve(uploadRoot, relativePath || '');

  if (!target.startsWith(uploadRoot)) {
    return null;
  }
  return target;
}

export function toPublicImageUrl(relativePath) {
  if (!relativePath) return null;
  const safe = relativePath.replace(/\\/g, '/');
  return `${config.image.publicUrlBase}/${safe}`;
}

export function absolutePathFromPublicUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const base = `${config.image.publicUrlBase}/`;
  if (!url.startsWith(base)) return null;
  const relativePath = url.slice(base.length);
  return resolveUploadPath(relativePath);
}

export async function deleteFileIfExists(targetPath) {
  const filePath = normalizeTargetPath(targetPath);
  if (!filePath) return false;

  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export function buildImagePaths(baseName, extension, thumbnailSuffix = '-thumb') {
  const fileName = `${baseName}${extension}`;
  const thumbName = `${baseName}${thumbnailSuffix}${extension}`;
  const imageRelativePath = fileName;
  const thumbnailRelativePath = join(config.image.thumbnailDir, thumbName).replace(/\\/g, '/');

  return {
    fileName,
    thumbName,
    imageRelativePath,
    thumbnailRelativePath,
    imageAbsolutePath: resolveUploadPath(imageRelativePath),
    thumbnailAbsolutePath: resolveUploadPath(thumbnailRelativePath),
  };
}
