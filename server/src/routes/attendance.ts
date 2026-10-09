import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, requirePerm } from '../auth/permissions';
import { one, q, tx } from '../db';
import { authenticate, type AuthContext } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { dateString, validateBody } from '../middleware/validate';

export const router = Router();
router.use(authenticate);

const auth = (req: { auth?: AuthContext }): AuthContext => {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.auth;
};

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused', 'leave', 'half-day'] as const;

/** Day sheet for a class (teachers/admin/staff with attendance.view). */
router.get('/', requirePerm(PERMISSIONS.attendanceView), async (req, res, next) => {
  try {
    const a = auth(req);
    if (a.role === 'student') {
      throw new AppError(403, 'FORBIDDEN', 'Students should use /attendance/me.');
    }
    const { date, classId, sectionId, subjectId } = req.query as Record<string, string | undefined>;
    if (!date) throw new AppError(422, 'VALIDATION_ERROR', 'date is required.');
    const params: unknown[] = [a.schoolId, date];
    const where = ['ar.school_id = $1', 'ar.date = $2', `ar.person_type = 'student'`];
    if (classId) { params.push(classId); where.push(`ar.class_id = $${params.length}`); }
    if (sectionId) { params.push(sectionId); where.push(`ar.section_id = $${params.length}`); }
    if (subjectId) { params.push(subjectId); where.push(`ar.subject_id = $${params.length}`); }
    const rows = await q(
      `SELECT ar.student_id AS "studentId", ar.status, ar.remarks,
              TRIM(s.first_name || ' ' || s.last_name) AS "studentName", s.roll_no AS "rollNo"
       FROM attendance_records ar JOIN students s ON s.id = ar.student_id
       WHERE ${where.join(' AND ')} ORDER BY s.first_name, s.last_name`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** Own attendance history + summary for the signed-in student. */
router.get('/me', requirePerm(PERMISSIONS.attendanceView), async (req, res, next) => {
  try {
    const a = auth(req);
    if (a.role !== 'student' || !a.linkedStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Only student accounts have personal attendance here.');
    }
    const { from, to } = req.query as { from?: string; to?: string };
    const params: unknown[] = [a.linkedStudentId];
    const where = ['student_id = $1'];
    if (from) { params.push(from); where.push(`date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`date <= $${params.length}`); }
    const rows = await q(
      `SELECT date, status, remarks FROM attendance_records
       WHERE ${where.join(' AND ')} ORDER BY date DESC LIMIT 400`,
      params,
    );
    res.json({ data: { records: rows, summary: summarize(rows as { status: string }[]) } });
  } catch (err) {
    next(err);
  }
});

export function summarize(rows: { status: string }[]): {
  total: number; present: number; absent: number; late: number;
  excused: number; leave: number; halfDay: number; pct: number;
} {
  const c = { total: rows.length, present: 0, absent: 0, late: 0, excused: 0, leave: 0, halfDay: 0 };
  for (const r of rows) {
    if (r.status === 'present') c.present += 1;
    else if (r.status === 'absent') c.absent += 1;
    else if (r.status === 'late') c.late += 1;
    else if (r.status === 'excused') c.excused += 1;
    else if (r.status === 'leave') c.leave += 1;
    else if (r.status === 'half-day') c.halfDay += 1;
  }
  const denom = c.total - c.excused - c.leave;
  const pct = denom <= 0 ? 100 : Math.round(((c.present + c.late + c.halfDay) / denom) * 10000) / 100;
  return { ...c, pct };
}

/** Summary for any student (staff roles) over a date range. */
router.get('/summary', requirePerm(PERMISSIONS.attendanceView), async (req, res, next) => {
  try {
    const a = auth(req);
    let { studentId, from, to } = req.query as Record<string, string | undefined>;
    if (a.role === 'student') studentId = a.linkedStudentId ?? '';
    if (!studentId) throw new AppError(422, 'VALIDATION_ERROR', 'studentId is required.');
    const params: unknown[] = [studentId, a.schoolId];
    const where = ['ar.student_id = $1', 'ar.school_id = $2'];
    if (from) { params.push(from); where.push(`ar.date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`ar.date <= $${params.length}`); }
    const rows = await q<{ status: string }>(
      `SELECT ar.status FROM attendance_records ar WHERE ${where.join(' AND ')}`, params,
    );
    res.json({ data: { studentId, ...summarize(rows) } });
  } catch (err) {
    next(err);
  }
});

const bulkSchema = z.object({
  date: dateString,
  classId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  subjectId: z.string().nullable().optional(),
  records: z.array(z.object({
    studentId: z.string().min(1),
    status: z.enum(ATTENDANCE_STATUSES),
    remarks: z.string().max(200).optional().default(''),
  })).min(1).max(300),
});

/**
 * Save a full day sheet atomically: replaces any existing records for the same
 * (date, class, section, subject) scope, then inserts. Validates class membership.
 */
router.post('/bulk', requirePerm(PERMISSIONS.attendanceMark), validateBody(bulkSchema), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as z.infer<typeof bulkSchema>;
    const cls = await one(`SELECT id FROM classes WHERE id = $1 AND school_id = $2`, [b.classId, a.schoolId]);
    if (!cls) throw new AppError(422, 'VALIDATION_ERROR', 'Class does not exist.');
    const pupils = await q<{ id: string }>(
      `SELECT id FROM students WHERE school_id = $1 AND class_id = $2 AND archived = FALSE`,
      [a.schoolId, b.classId],
    );
    const valid = new Set(pupils.map((p) => p.id));
    const stray = b.records.filter((r) => !valid.has(r.studentId));
    if (stray.length > 0) {
      throw new AppError(422, 'VALIDATION_ERROR', `${stray.length} student(s) are not in this class.`);
    }
    await tx(async (client) => {
      if (b.subjectId) {
        await client.query(
          `DELETE FROM attendance_records
           WHERE school_id = $1 AND date = $2 AND person_type = 'student' AND class_id = $3 AND subject_id = $4`,
          [a.schoolId, b.date, b.classId, b.subjectId],
        );
      } else {
        await client.query(
          `DELETE FROM attendance_records
           WHERE school_id = $1 AND date = $2 AND person_type = 'student' AND class_id = $3 AND subject_id IS NULL`,
          [a.schoolId, b.date, b.classId],
        );
      }
      for (const r of b.records) {
        await client.query(
          `INSERT INTO attendance_records (id, school_id, person_type, student_id, date, class_id,
            section_id, subject_id, status, remarks, marked_by)
           VALUES ($1,$2,'student',$3,$4,$5,$6,$7,$8,$9,$10)`,
          [randomUUID(), a.schoolId, r.studentId, b.date, b.classId, b.sectionId ?? null,
            b.subjectId ?? null, r.status, r.remarks ?? '', a.userId],
        );
      }
    });
    res.status(201).json({ data: { saved: b.records.length } });
  } catch (err) {
    next(err);
  }
});
