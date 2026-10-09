import type { NextFunction, Request, Response } from 'express';

/** Typed API error with a machine-readable code the mobile app can switch on. */
export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'NOT_FOUND', 'Endpoint not found'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details ?? null } });
    return;
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    if (code === '23505') {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Record already exists', details: null } });
      return;
    }
    if (code === '23503') {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Referenced record does not exist', details: null } });
      return;
    }
  }
  // eslint-disable-next-line no-console
  console.error('[api:error]', err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong', details: null } });
}
