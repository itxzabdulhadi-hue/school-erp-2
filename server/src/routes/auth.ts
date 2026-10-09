import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../auth/password';
import { ROLES, permissionsFor, type Role } from '../auth/permissions';
import { issueRefresh, revokeRefresh, rotateRefresh, signAccess } from '../auth/tokens';
import { one, q } from '../db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { validateBody } from '../middleware/validate';

export const router = Router();

/** Tiny in-memory login throttle (10 attempts / 10 min per key). Use Redis when scaling. */
const attempts = new Map<string, { count: number; resetAt: number }>();
function throttled(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 10;
}

interface UserRow {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  linkedStudentId: string | null;
  linkedTeacherId: string | null;
  linkedStaffId: string | null;
}

const USER_COLS = `id, school_id AS "schoolId", name, email, password_hash AS "passwordHash",
  role, is_active AS "isActive", linked_student_id AS "linkedStudentId",
  linked_teacher_id AS "linkedTeacherId", linked_staff_id AS "linkedStaffId"`;

function publicUser(u: UserRow) {
  return {
    id: u.id, schoolId: u.schoolId, name: u.name, email: u.email, role: u.role,
    linkedStudentId: u.linkedStudentId, linkedTeacherId: u.linkedTeacherId,
    linkedStaffId: u.linkedStaffId,
  };
}

const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(200),
  schoolSlug: z.string().min(1).max(80).optional(),
  deviceLabel: z.string().max(120).optional().default(''),
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password, schoolSlug, deviceLabel } = req.body as z.infer<typeof loginSchema>;
    if (throttled(`${req.ip}:${email.toLowerCase()}`)) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many login attempts. Try again later.');
    }
    const matches = await q<UserRow>(`SELECT ${USER_COLS} FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    let user: UserRow | undefined;
    if (schoolSlug) {
      const school = await one<{ id: string }>(`SELECT id FROM schools WHERE slug = $1`, [schoolSlug]);
      user = matches.find((m) => school && m.schoolId === school.id);
    } else {
      if (matches.length > 1) {
        throw new AppError(422, 'VALIDATION_ERROR', 'This email exists in multiple schools; include schoolSlug.');
      }
      [user] = matches;
    }
    // Constant-shape failure: never reveal whether the email exists.
    const ok = user && user.isActive && ROLES.includes(user.role)
      ? await verifyPassword(password, user.passwordHash)
      : false;
    if (!user || !ok) {
      // Burn comparable time on unknown users to blunt enumeration timing.
      await hashPassword('dummy-timing-burn');
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    const accessToken = signAccess(user.id, user.role, user.schoolId);
    const refreshToken = await issueRefresh(user.id, deviceLabel);
    res.json({ data: { accessToken, refreshToken, user: publicUser(user), permissions: permissionsFor(user.role) } });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', validateBody(z.object({ refreshToken: z.string().min(10) })), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const userId = await rotateRefresh(refreshToken);
    if (!userId) throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token is invalid or expired.');
    const user = await one<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [userId]);
    if (!user || !user.isActive) throw new AppError(401, 'UNAUTHENTICATED', 'Session is no longer valid.');
    const accessToken = signAccess(user.id, user.role, user.schoolId);
    const nextRefresh = await issueRefresh(user.id);
    res.json({ data: { accessToken, refreshToken: nextRefresh, user: publicUser(user), permissions: permissionsFor(user.role) } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', validateBody(z.object({ refreshToken: z.string().min(1) })), async (req, res, next) => {
  try {
    await revokeRefresh((req.body as { refreshToken: string }).refreshToken);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await one<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [req.auth!.userId]);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Session is no longer valid.');
    res.json({ data: { user: publicUser(user), permissions: permissionsFor(user.role) } });
  } catch (err) {
    next(err);
  }
});
