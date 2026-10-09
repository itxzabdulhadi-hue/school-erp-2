import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import multer from 'multer';
import { config } from '../config';
import { AppError } from './errors';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/zip',
]);

export function ensureUploadDir(): string {
  const dir = join(process.cwd(), config.uploadDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Multer disk upload. Files land OUTSIDE any static route and are served only
 * through permission-checked download endpoints. Filenames are randomized.
 */
export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase().slice(0, 10);
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new AppError(422, 'VALIDATION_ERROR', `File type not allowed: ${file.mimetype}`));
  },
});
