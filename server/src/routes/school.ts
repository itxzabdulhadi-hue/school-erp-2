import { Router } from 'express';
import { z } from 'zod';
import { one } from '../db';
import { coerceScale } from '../lib/grading';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { validateQuery } from '../middleware/validate';

export const router = Router();

const PUBLIC_COLS = `id, slug, name, tagline, logo_url AS "logoUrl",
  primary_color AS "primaryColor", accent_color AS "accentColor",
  currency, currency_symbol AS "currencySymbol", date_format AS "dateFormat",
  timezone, language`;

/**
 * Public branding bootstrap for white-label apps (same data as a school website).
 * No auth: the mobile app needs name/logo/colors before login.
 */
router.get(
  '/public',
  validateQuery(z.object({ slug: z.string().min(1).max(80) })),
  async (req, res, next) => {
    try {
      const { slug } = req.query as { slug: string };
      const school = await one(`SELECT ${PUBLIC_COLS} FROM schools WHERE slug = $1`, [slug]);
      if (!school) throw new AppError(404, 'NOT_FOUND', 'Unknown school.');
      res.json({ data: school });
    } catch (err) {
      next(err);
    }
  },
);

/** Full school settings for authenticated clients (grading scale, toggles, …). */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const school = await one<Record<string, unknown>>(
      `SELECT ${PUBLIC_COLS}, grading_scale AS "gradingScale", settings FROM schools WHERE id = $1`,
      [req.auth!.schoolId],
    );
    if (!school) throw new AppError(404, 'NOT_FOUND', 'School not found.');
    res.json({ data: { ...school, gradingScale: coerceScale(school.gradingScale) } });
  } catch (err) {
    next(err);
  }
});
