import crypto from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { createImageRecord, listImageRecordsForUser } from './db.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_UPLOAD_DIR = process.env.IMAGE_UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads');

const extensionsByMimeType = new Map([
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
  ['image/heic', '.heic'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });

function getSafeOriginalFilename(filename) {
  return path.basename(filename || 'upload').replaceAll(/[^a-zA-Z0-9._-]/g, '_');
}

function createByteCounter() {
  let byteSize = 0;

  return {
    stream: new Transform({
      transform(chunk, _encoding, callback) {
        byteSize += chunk.length;
        callback(null, chunk);
      },
    }),
    get byteSize() {
      return byteSize;
    },
  };
}

export function getImageUploadLimits() {
  return {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  };
}

export function listImagesForUser(userId) {
  return listImageRecordsForUser(userId);
}

export function createStoredImageReadStream(image) {
  return createReadStream(image.storage_path);
}

export async function storeUploadedImage(userId, part) {
  if (!part) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Expected multipart form data with one image file',
    };
  }

  const extension = extensionsByMimeType.get(part.mimetype);
  if (!extension) {
    part.file.resume();
    return {
      ok: false,
      statusCode: 415,
      error: 'Expected an image file',
    };
  }

  const id = crypto.randomUUID();
  const originalFilename = getSafeOriginalFilename(part.filename);
  const storedFilename = `${id}${extension}`;
  const storagePath = path.join(IMAGE_UPLOAD_DIR, storedFilename);
  const byteCounter = createByteCounter();

  try {
    await pipeline(part.file, byteCounter.stream, createWriteStream(storagePath, { flags: 'wx' }));
  } catch (error) {
    rmSync(storagePath, { force: true });
    throw error;
  }

  if (part.file.truncated) {
    rmSync(storagePath, { force: true });
    return {
      ok: false,
      statusCode: 413,
      error: 'Image is too large',
    };
  }

  const image = createImageRecord({
    id,
    userId,
    originalFilename,
    storedFilename,
    mimeType: part.mimetype,
    byteSize: byteCounter.byteSize,
    storagePath,
  });

  return {
    ok: true,
    image,
  };
}
