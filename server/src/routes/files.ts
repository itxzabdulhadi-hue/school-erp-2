import { existsSync } from 'fs';
import { join, resolve, sep } from 'path';
import type { NextFunction, Response } from 'express';
import { config } from '../config';
import { ensureUploadDir } from '../middleware/upload';
import { AppError } from '../middleware/errors';

/**
 * Serve an uploaded file AFTER the route has verified permissions.
 * Path traversal safe: the stored name must resolve inside the upload dir.
 */
export function downloadFile(res: Response, storedName: string, downloadName: string, next: NextFunction): void {
  try {
    const dir = ensureUploadDir();
    const abs = resolve(join(dir, storedName));
    if (!abs.startsWith(dir + sep)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid file reference.');
    if (!existsSync(abs)) throw new AppError(404, 'NOT_FOUND', 'File no longer exists on the server.');
    res.download(abs, downloadName || storedName);
  } catch (err) {
    next(err);
  }
}

export function uploadPath(storedName: string): string {
  return join(resolve(join(process.cwd(), config.uploadDir)), storedName);
}
