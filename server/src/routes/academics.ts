import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, requirePerm } from '../auth/permissions';
import { one, q, tx } from '../db';
import { coerceScale, gradeFor } from '../lib/grading';
import { authenticate, type AuthContext } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { dateString, timeString, validateBody } from '../middleware/validate';

export const router = Router();
router.use(authenticate);

const auth = (req: { auth?: AuthContext }): AuthContext => {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.auth;
};

/* --------------------------- classes & subjects ---------------------------- */

router.get('/classes', requirePerm(PERMISSIONS.classesView), async (req, res, next) => {
  try {
    const a = auth(req);
    const classes = await q(
      `SELECT id, school_id AS "schoolId", name, numeric_order AS "numericOrder", room,
              class_teacher_id AS "classTeacherId"
       FROM classes WHERE school_id = $1 ORDER BY numeric_order, name`,
      [a.schoolId],
    );
    const sections = await q(
      `SELECT id, class_id AS "classId", name, room, capacity, class_teacher_id AS "classTeacherId"
       FROM sections WHERE school_id = $1 ORDER BY name`,
      [a.schoolId],
    );
    res.json({ data: classes.map((c) => ({ ...c, sections: sections.filter((s) => s.classId === c.id) })) });
  } catch (err) {
    next(err);
  }
});

router.get('/subjects', requirePerm(PERMISSIONS.subjectsView), async (req, res, next) => {
  try {
    const { classId } = req.query as { classId?: string };
    const a = auth(req);
    if (classId) {
      const rows = await q(
        `SELECT s.id, s.name, s.code, s.type, s.credit_hours AS "creditHours",
                cs.teacher_id AS "teacherId",
                TRIM(COALESCE(t.first_name,'') || ' ' || COALESCE(t.last_name,'')) AS "teacherName"
         FROM class_subjects cs
         JOIN subjects s ON s.id = cs.subject_id
         LEFT JOIN teachers t ON t.id = cs.teacher_id
         WHERE cs.class_id = $1 ORDER BY s.name`,
        [classId],
      );
      res.json({ data: rows });
      return;
    }
    const rows = await q(
      `SELECT id, name, code, type, credit_hours AS "creditHours", description
       FROM subjects WHERE school_id = $1 ORDER BY name`,
      [a.schoolId],
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- timetable -------------------------------- */

router.get('/timetable', requirePerm(PERMISSIONS.timetableView), async (req, res, next) => {
  try {
    const a = auth(req);
    let { classId, sectionId, teacherId, mine } = req.query as Record<string, string | undefined>;
    if (a.role === 'student') {
      if (!a.linkedStudentId) throw new AppError(403, 'FORBIDDEN', 'No student profile linked.');
      const s = await one<{ classId: string | null; sectionId: string | null }>(
        `SELECT class_id AS "classId", section_id AS "sectionId" FROM students WHERE id = $1`, [a.linkedStudentId],
      );
      classId = s?.classId ?? '';
      sectionId = s?.sectionId ?? undefined;
    }
    if (mine === '1' && a.linkedTeacherId) teacherId = a.linkedTeacherId;
    const params: unknown[] = [a.schoolId];
    const where = ['ts.school_id = $1'];
    if (classId) { params.push(classId); where.push(`ts.class_id = $${params.length}`); }
    if (sectionId) { params.push(sectionId); where.push(`ts.section_id = $${params.length}`); }
    if (teacherId) { params.push(teacherId); where.push(`ts.teacher_id = $${params.length}`); }
    const rows = await q(
      `SELECT ts.id, ts.class_id AS "classId", ts.section_id AS "sectionId",
              ts.subject_id AS "subjectId", ts.teacher_id AS "teacherId",
              ts.day_of_week AS "dayOfWeek", ts.start_time AS "startTime",
              ts.end_time AS "endTime", ts.room,
              c.name AS "className", sec.name AS "sectionName",
              s.name AS "subjectName", s.code AS "subjectCode",
              TRIM(COALESCE(t.first_name,'') || ' ' || COALESCE(t.last_name,'')) AS "teacherName"
       FROM timetable_slots ts
       JOIN classes c ON c.id = ts.class_id
       LEFT JOIN sections sec ON sec.id = ts.section_id
       JOIN subjects s ON s.id = ts.subject_id
       LEFT JOIN teachers t ON t.id = ts.teacher_id
       WHERE ${where.join(' AND ')}
       ORDER BY ts.day_of_week, ts.start_time`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- exams ---------------------------------- */

router.get('/exams', requirePerm(PERMISSIONS.examsView), async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT id, name, term, academic_year AS "academicYear",
              start_date AS "startDate", end_date AS "endDate", status
       FROM exams WHERE school_id = $1 ORDER BY start_date DESC`,
      [auth(req).schoolId],
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/exams/:id', requirePerm(PERMISSIONS.examsView), async (req, res, next) => {
  try {
    const a = auth(req);
    const exam = await one(
      `SELECT id, name, term, academic_year AS "academicYear",
              start_date AS "startDate", end_date AS "endDate", status
       FROM exams WHERE id = $1 AND school_id = $2`,
      [req.params.id, a.schoolId],
    );
    if (!exam) throw new AppError(404, 'NOT_FOUND', 'Exam not found.');
    const { classId } = req.query as { classId?: string };
    const params: unknown[] = [req.params.id];
    let extra = '';
    if (classId) { params.push(classId); extra = ` AND es.class_id = $${params.length}`; }
    const schedules = await q(
      `SELECT es.id, es.exam_id AS "examId", es.class_id AS "classId", es.subject_id AS "subjectId",
              es.date, es.start_time AS "startTime", es.end_time AS "endTime", es.room,
              es.max_marks AS "maxMarks", es.passing_marks AS "passingMarks",
              c.name AS "className", s.name AS "subjectName", s.code AS "subjectCode"
       FROM exam_schedules es
       JOIN classes c ON c.id = es.class_id
       JOIN subjects s ON s.id = es.subject_id
       WHERE es.exam_id = $1${extra} ORDER BY es.date, es.start_time`,
      params,
    );
    res.json({ data: { ...exam, schedules } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------- results ----------------------------------- */

interface ResultSubject {
  subjectId: string;
  subjectName: string;
  obtained: number;
  max: number;
  absent: boolean;
}

router.get('/results', requirePerm(PERMISSIONS.resultsView), async (req, res, next) => {
  try {
    const a = auth(req);
    let { examId, classId, studentId } = req.query as Record<string, string | undefined>;
    if (!examId) throw new AppError(422, 'VALIDATION_ERROR', 'examId is required.');
    const exam = await one(`SELECT id, name, status FROM exams WHERE id = $1 AND school_id = $2`, [examId, a.schoolId]);
    if (!exam) throw new AppError(404, 'NOT_FOUND', 'Exam not found.');
    if (a.role === 'student') {
      if (!a.linkedStudentId) throw new AppError(403, 'FORBIDDEN', 'No student profile linked.');
      studentId = a.linkedStudentId;
      const s = await one<{ classId: string | null }>(
        `SELECT class_id AS "classId" FROM students WHERE id = $1`, [studentId],
      );
      classId = s?.classId ?? undefined;
    }
    if (!classId) throw new AppError(422, 'VALIDATION_ERROR', 'classId is required.');
    const school = await one<{ gradingScale: unknown }>(
      `SELECT grading_scale AS "gradingScale" FROM schools WHERE id = $1`, [a.schoolId],
    );
    const scale = coerceScale(school?.gradingScale);

    const schedules = await q<{ id: string; subjectId: string; subjectName: string; maxMarks: number }>(
      `SELECT es.id, es.subject_id AS "subjectId", s.name AS "subjectName", es.max_marks AS "maxMarks"
       FROM exam_schedules es JOIN subjects s ON s.id = es.subject_id
       WHERE es.exam_id = $1 AND es.class_id = $2 ORDER BY s.name`,
      [examId, classId],
    );
    const students = await q<{ id: string; firstName: string; lastName: string; rollNo: string }>(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", roll_no AS "rollNo"
       FROM students WHERE school_id = $1 AND class_id = $2 AND archived = FALSE
         AND status = 'active' ${studentId ? 'AND id = $3' : ''} ORDER BY first_name, last_name`,
      studentId ? [a.schoolId, classId, studentId] : [a.schoolId, classId],
    );
    const marks = await q<{ scheduleId: string; studentId: string; obtainedMarks: number; maxMarks: number; isAbsent: boolean }>(
      `SELECT schedule_id AS "scheduleId", student_id AS "studentId",
              obtained_marks AS "obtainedMarks", max_marks AS "maxMarks", is_absent AS "isAbsent"
       FROM marks WHERE exam_id = $1`,
      [examId],
    );
    const byKey = new Map(marks.map((m) => [`${m.scheduleId}:${m.studentId}`, m]));
    const rows = students.map((s) => {
      const subjects: ResultSubject[] = schedules.map((sch) => {
        const m = byKey.get(`${sch.id}:${s.id}`);
        return {
          subjectId: sch.subjectId, subjectName: sch.subjectName,
          obtained: m ? Number(m.obtainedMarks) : 0, max: m ? Number(m.maxMarks) : Number(sch.maxMarks),
          absent: m ? m.isAbsent : false,
        };
      });
      const total = subjects.reduce((t, x) => t + x.obtained, 0);
      const maxTotal = subjects.reduce((t, x) => t + x.max, 0);
      const percent = maxTotal > 0 ? Math.round((total / maxTotal) * 10000) / 100 : 0;
      const g = gradeFor(percent, scale);
      return {
        studentId: s.id, studentName: `${s.firstName} ${s.lastName}`.trim(), rollNo: s.rollNo,
        subjects, total, maxTotal, percent, grade: g.grade, gpa: g.gpa, passed: g.passed, rank: 0,
      };
    });
    const ranked = [...rows].sort((x, y) => y.percent - x.percent);
    ranked.forEach((r, i) => { r.rank = i + 1; });
    const percents = rows.map((r) => r.percent);
    res.json({
      data: {
        exam,
        classId,
        rows,
        stats: {
          students: rows.length,
          average: rows.length ? Math.round((percents.reduce((t, p) => t + p, 0) / rows.length) * 100) / 100 : 0,
          highest: rows.length ? Math.max(...percents) : 0,
          passPct: rows.length ? Math.round((rows.filter((r) => r.passed).length / rows.length) * 10000) / 100 : 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- marks ----------------------------------- */

const markSchema = z.object({
  scheduleId: z.string().min(1),
  studentId: z.string().min(1),
  obtainedMarks: z.number().min(0).max(10000),
  isAbsent: z.boolean().optional().default(false),
  remarks: z.string().max(300).optional().default(''),
});

async function assertMarkTarget(schoolId: string, scheduleId: string, studentId: string, obtained: number) {
  const sch = await one<{ id: string; classId: string; examId: string; subjectId: string; maxMarks: number }>(
    `SELECT es.id, es.class_id AS "classId", es.exam_id AS "examId",
            es.subject_id AS "subjectId", es.max_marks AS "maxMarks"
     FROM exam_schedules es JOIN exams e ON e.id = es.exam_id
     WHERE es.id = $1 AND e.school_id = $2`,
    [scheduleId, schoolId],
  );
  if (!sch) throw new AppError(422, 'VALIDATION_ERROR', 'Exam schedule does not exist.');
  if (obtained > Number(sch.maxMarks)) {
    throw new AppError(422, 'VALIDATION_ERROR', `Obtained marks exceed maximum (${sch.maxMarks}).`);
  }
  const stu = await one(
    `SELECT id FROM students WHERE id = $1 AND school_id = $2 AND class_id = $3 AND archived = FALSE`,
    [studentId, schoolId, sch.classId],
  );
  if (!stu) throw new AppError(422, 'VALIDATION_ERROR', 'Student is not in the scheduled class.');
  return sch;
}

router.post('/marks', requirePerm(PERMISSIONS.resultsEnter), validateBody(markSchema), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as z.infer<typeof markSchema>;
    const sch = await assertMarkTarget(a.schoolId, b.scheduleId, b.studentId, b.obtainedMarks);
    await q(
      `INSERT INTO marks (id, exam_id, schedule_id, student_id, subject_id, obtained_marks, max_marks, is_absent, remarks, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (schedule_id, student_id)
       DO UPDATE SET obtained_marks = EXCLUDED.obtained_marks, is_absent = EXCLUDED.is_absent,
                     remarks = EXCLUDED.remarks, updated_at = NOW()`,
      [randomUUID(), sch.examId, b.scheduleId, b.studentId, sch.subjectId,
        b.isAbsent ? 0 : b.obtainedMarks, sch.maxMarks, b.isAbsent, b.remarks],
    );
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.post('/marks/bulk', requirePerm(PERMISSIONS.resultsEnter),
  validateBody(z.object({
    scheduleId: z.string().min(1),
    rows: z.array(z.object({
      studentId: z.string().min(1),
      obtainedMarks: z.number().min(0).max(10000),
      isAbsent: z.boolean().optional().default(false),
      remarks: z.string().max(300).optional().default(''),
    })).min(1).max(300),
  })), async (req, res, next) => {
    try {
      const a = auth(req);
      const { scheduleId, rows } = req.body as { scheduleId: string; rows: z.infer<typeof markSchema>[] };
      await tx(async (client) => {
        for (const r of rows) {
          // Reuse validation (reads are fine inside the caller's tx-less helper; writes below are atomic).
          const sch = await assertMarkTarget(a.schoolId, scheduleId, r.studentId, r.obtainedMarks);
          await client.query(
            `INSERT INTO marks (id, exam_id, schedule_id, student_id, subject_id, obtained_marks, max_marks, is_absent, remarks, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
             ON CONFLICT (schedule_id, student_id)
             DO UPDATE SET obtained_marks = EXCLUDED.obtained_marks, is_absent = EXCLUDED.is_absent,
                           remarks = EXCLUDED.remarks, updated_at = NOW()`,
            [randomUUID(), sch.examId, scheduleId, r.studentId, sch.subjectId,
              r.isAbsent ? 0 : r.obtainedMarks, sch.maxMarks, r.isAbsent, r.remarks ?? ''],
          );
        }
      });
      res.status(201).json({ data: { saved: rows.length } });
    } catch (err) {
      next(err);
    }
  });

/* ------------------------- exams admin (timetable too) ---------------------- */

const adminOnly = requirePerm('admin.only'); // pseudo-permission: only the admin bypass satisfies it

router.post('/exams', adminOnly, validateBody(z.object({
  name: z.string().min(1).max(120),
  term: z.string().max(60).optional().default(''),
  academicYear: z.string().max(20).optional().default(''),
  startDate: dateString,
  endDate: dateString,
  status: z.enum(['upcoming', 'ongoing', 'completed', 'cancelled']).optional().default('upcoming'),
})), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as { name: string; term: string; academicYear: string; startDate: string; endDate: string; status: string };
    const row = await one<{ id: string }>(
      `INSERT INTO exams (id, school_id, name, term, academic_year, start_date, end_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [randomUUID(), a.schoolId, b.name, b.term, b.academicYear, b.startDate, b.endDate, b.status],
    );
    res.status(201).json({ data: { id: row!.id } });
  } catch (err) {
    next(err);
  }
});

router.post('/exam-schedules', adminOnly, validateBody(z.object({
  examId: z.string().min(1),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  date: dateString,
  startTime: timeString,
  endTime: timeString,
  room: z.string().max(60).optional().default(''),
  maxMarks: z.number().min(1).max(10000).optional().default(100),
  passingMarks: z.number().min(0).max(10000).optional().default(40),
})), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as Record<string, string | number>;
    const exam = await one(`SELECT id FROM exams WHERE id = $1 AND school_id = $2`, [b.examId, a.schoolId]);
    if (!exam) throw new AppError(422, 'VALIDATION_ERROR', 'Exam does not exist.');
    try {
      const row = await one<{ id: string }>(
        `INSERT INTO exam_schedules (id, exam_id, class_id, subject_id, date, start_time, end_time, room, max_marks, passing_marks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [randomUUID(), b.examId, b.classId, b.subjectId, b.date, b.startTime, b.endTime, b.room, b.maxMarks, b.passingMarks],
      );
      res.status(201).json({ data: { id: row!.id } });
    } catch (err) {
      next(new AppError(409, 'CONFLICT', 'A schedule already exists for this exam, class and subject.'));
    }
  } catch (err) {
    next(err);
  }
});
