import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, requirePerm } from '../auth/permissions';
import { config } from '../config';
import { one, q } from '../db';
import { authenticate, type AuthContext } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { dateString, timeString, validateBody } from '../middleware/validate';

export const router = Router();
router.use(authenticate);

const auth = (req: { auth?: AuthContext }): AuthContext => {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.auth;
};

const AUDIENCES = ['all', 'admin', 'teacher', 'student', 'staff'] as const;

/* ------------------------------ announcements ------------------------------ */

router.get('/announcements', requirePerm(PERMISSIONS.announcementsView), async (req, res, next) => {
  try {
    const a = auth(req);
    const rows = await q(
      `SELECT id, title, body, audience, publish_date AS "publishDate", expiry_date AS "expiryDate",
              priority, created_by AS "createdBy", created_at AS "createdAt"
       FROM announcements
       WHERE school_id = $1 AND (audience = 'all' OR audience = $2)
         AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
       ORDER BY publish_date DESC, created_at DESC LIMIT 100`,
      [a.schoolId, a.role],
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(8000).optional().default(''),
  audience: z.enum(AUDIENCES).optional().default('all'),
  publishDate: dateString.optional(),
  expiryDate: dateString.nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
});

router.post('/announcements', requirePerm(PERMISSIONS.announcementsCreate), validateBody(announcementSchema), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as z.infer<typeof announcementSchema>;
    const row = await one<{ id: string }>(
      `INSERT INTO announcements (id, school_id, title, body, audience, publish_date, expiry_date, priority, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [randomUUID(), a.schoolId, b.title, b.body, b.audience,
        b.publishDate ?? new Date().toISOString().slice(0, 10), b.expiryDate ?? null, b.priority, a.userId],
    );
    res.status(201).json({ data: { id: row!.id } });
  } catch (err) {
    next(err);
  }
});

router.delete('/announcements/:id', requirePerm(PERMISSIONS.announcementsCreate), async (req, res, next) => {
  try {
    const a = auth(req);
    const ann = await one<{ createdBy: string }>(
      `SELECT created_by AS "createdBy" FROM announcements WHERE id = $1 AND school_id = $2`,
      [req.params.id, a.schoolId],
    );
    if (!ann) throw new AppError(404, 'NOT_FOUND', 'Announcement not found.');
    if (a.role !== 'admin' && ann.createdBy !== a.userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the author (or admin) can delete this.');
    }
    await q(`DELETE FROM announcements WHERE id = $1`, [req.params.id]);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- events ---------------------------------- */

router.get('/events', requirePerm(PERMISSIONS.eventsView), async (req, res, next) => {
  try {
    const a = auth(req);
    const { from, to } = req.query as { from?: string; to?: string };
    const params: unknown[] = [a.schoolId, a.role];
    const where = ['school_id = $1', `(audience = 'all' OR audience = $2)`];
    if (from) { params.push(from); where.push(`date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`date <= $${params.length}`); }
    const rows = await q(
      `SELECT id, title, description, date, start_time AS "startTime", end_time AS "endTime",
              location, audience, created_at AS "createdAt"
       FROM events WHERE ${where.join(' AND ')} ORDER BY date ASC LIMIT 200`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/events', requirePerm(PERMISSIONS.eventsCreate), validateBody(z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().default(''),
  date: dateString,
  startTime: timeString.nullable().optional(),
  endTime: timeString.nullable().optional(),
  location: z.string().max(200).optional().default(''),
  audience: z.enum(AUDIENCES).optional().default('all'),
})), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as Record<string, string | null>;
    const row = await one<{ id: string }>(
      `INSERT INTO events (id, school_id, title, description, date, start_time, end_time, location, audience, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [randomUUID(), a.schoolId, b.title, b.description ?? '', b.date, b.startTime ?? null,
        b.endTime ?? null, b.location ?? '', b.audience ?? 'all', a.userId],
    );
    res.status(201).json({ data: { id: row!.id } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ notifications ------------------------------ */

router.get('/notifications', requirePerm(PERMISSIONS.notificationsView), async (req, res, next) => {
  try {
    const a = auth(req);
    const rows = await q(
      `SELECT id, title, body, kind, link, is_read AS "isRead", created_at AS "createdAt"
       FROM notifications WHERE school_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [a.schoolId, a.userId],
    );
    const unread = await one<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE school_id = $1 AND user_id = $2 AND is_read = FALSE`,
      [a.schoolId, a.userId],
    );
    res.json({ data: { items: rows, unreadCount: unread?.count ?? 0 } });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/:id/read', requirePerm(PERMISSIONS.notificationsView), async (req, res, next) => {
  try {
    const a = auth(req);
    await q(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, [req.params.id, a.userId]);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', requirePerm(PERMISSIONS.notificationsView), async (req, res, next) => {
  try {
    await q(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [auth(req).userId]);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

/** Best-effort Expo push fan-out. Failures never fail the broadcast. */
async function pushToTokens(tokens: string[], title: string, body: string): Promise<void> {
  if (!config.expoPushEnabled || tokens.length === 0) return;
  const expoTokens = tokens.filter((t) => t.startsWith('ExponentPushToken['));
  for (let i = 0; i < expoTokens.length; i += 100) {
    const chunk = expoTokens.slice(i, i + 100).map((to) => ({ to, title, body, sound: 'default' }));
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[push] fan-out chunk failed:', (err as Error).message);
    }
  }
}

/** Admin broadcast: per-user rows (so read-state is personal) + optional push. */
router.post('/notifications/broadcast', requirePerm(PERMISSIONS.notificationsBroadcast), validateBody(z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional().default(''),
  audience: z.enum(AUDIENCES).optional().default('all'),
  kind: z.string().max(40).optional().default('info'),
  link: z.string().max(300).optional().default(''),
})), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as { title: string; body: string; audience: string; kind: string; link: string };
    const targets = await q<{ id: string }>(
      `SELECT id FROM users WHERE school_id = $1 AND is_active = TRUE ${b.audience === 'all' ? '' : 'AND role = $2'}`,
      b.audience === 'all' ? [a.schoolId] : [a.schoolId, b.audience],
    );
    for (const t of targets) {
      await q(
        `INSERT INTO notifications (id, school_id, user_id, audience, title, body, kind, link)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [randomUUID(), a.schoolId, t.id, b.audience, b.title, b.body, b.kind, b.link],
      );
    }
    const ids = targets.map((t) => t.id);
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const devs = await q<{ pushToken: string }>(
        `SELECT push_token AS "pushToken" FROM devices WHERE user_id IN (${placeholders})`, ids,
      );
      await pushToTokens(devs.map((d) => d.pushToken), b.title, b.body);
    }
    res.status(201).json({ data: { delivered: targets.length } });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- devices --------------------------------- */

router.post('/devices', requirePerm(PERMISSIONS.notificationsView), validateBody(z.object({
  pushToken: z.string().min(10).max(300),
  platform: z.enum(['android', 'ios', 'web', '']).optional().default(''),
})), async (req, res, next) => {
  try {
    const a = auth(req);
    const { pushToken, platform } = req.body as { pushToken: string; platform: string };
    await q(
      `INSERT INTO devices (id, user_id, push_token, platform) VALUES ($1,$2,$3,$4)
       ON CONFLICT (push_token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform`,
      [randomUUID(), a.userId, pushToken, platform],
    );
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.delete('/devices', requirePerm(PERMISSIONS.notificationsView), async (req, res, next) => {
  try {
    const { pushToken } = req.query as { pushToken?: string };
    if (!pushToken) throw new AppError(422, 'VALIDATION_ERROR', 'pushToken is required.');
    await q(`DELETE FROM devices WHERE push_token = $1 AND user_id = $2`, [pushToken, auth(req).userId]);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
