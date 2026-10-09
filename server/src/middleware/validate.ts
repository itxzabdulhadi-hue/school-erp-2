import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from './errors';

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Expected HH:MM');

/** Validate req.body against a zod schema; replaces body with the parsed value. */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten()));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

/** Validate req.query against a zod schema; replaces query with the parsed value. */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Invalid query parameters', parsed.error.flatten()));
      return;
    }
    req.query = parsed.data as never;
    next();
  };
}
