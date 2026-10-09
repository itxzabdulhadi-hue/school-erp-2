import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, requirePerm } from '../auth/permissions';
import { one, q } from '../db';
import { authenticate, type AuthContext } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { upload } from '../middleware/upload';
import { dateString, validateBody } from '../middleware/validate';
import { downloadFile } from './files';

export const router = Router();
router.use(authenticate);

const auth = (req: { auth?: AuthContext }): AuthContext => {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.auth;
};

const HW_COLS = `h.id, h.school_id AS "schoolId", h.class_id AS "classId", h.section_id AS "sectionId",
  h.subject_id AS "subjectId", h.title, h.description, h.assigned_date AS "assignedDate",
  h.due_date AS "dueDate", h.status, h.attachment_path AS "attachmentPath",
  h.created_by AS "createdBy", c.name AS "className", sec.name AS "sectionName", s.name AS "subjectName"`;

const hwFrom = `FROM homework h
  JOIN classes c ON c.id = h.class_id
  LEFT JOIN sections sec ON sec.id = h.section_id
  JOIN subjects s ON s.id = h.subject_id`;

async function studentClass(schoolId: string, studentId: string): Promise<{ classId: string | null; sectionId: string | null } | null> {
  return one(
    `SELECT class_id AS "classId", section_id AS "sectionId"
     FROM students WHERE id = $1 AND school_id = $2`,
    [studentId, schoolId],
  );
}

router.get('/homework', requirePerm(PERMISSIONS.homeworkView), async (req, res, next) => {
  try {
    const a = auth(req);
    const { classId, subjectId, status } = req.query as Record<string, string | undefined>;
    const params: unknown[] = [a.schoolId];
    const where = ['h.school_id = $1'];
    if (a.role === 'student') {
      if (!a.linkedStudentId) throw new AppError(403, 'FORBIDDEN', 'No student profile linked.');
      const sc = await studentClass(a.schoolId, a.linkedStudentId);
      if (!sc?.classId) { res.json({ data: [] }); return; }
      params.push(sc.classId); where.push(`h.class_id = $${params.length}`);
      if (sc.sectionId) { params.push(sc.sectionId); where.push(`(h.section_id IS NULL OR h.section_id = $${params.length})`); }
    } else if (classId) {
      params.push(classId); where.push(`h.class_id = $${params.length}`);
    }
    if (subjectId) { params.push(subjectId); where.push(`h.subject_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`h.status = $${params.length}`); }
    const rows = await q(
      `SELECT ${HW_COLS}, COALESCE(hsc.cnt, 0) AS "submissionCount"
       ${hwFrom}
       LEFT JOIN (SELECT homework_id, COUNT(*)::int AS cnt FROM homework_submissions GROUP BY homework_id) hsc
         ON hsc.homework_id = h.id
       WHERE ${where.join(' AND ')} ORDER BY h.due_date DESC, h.created_at DESC LIMIT 200`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/homework/:id', requirePerm(PERMISSIONS.homeworkView), async (req, res, next) => {
  try {
    const a = auth(req);
    const hw = await one<{ classId: string; sectionId: string | null } & Record<string, unknown>>(
      `SELECT ${HW_COLS} ${hwFrom} WHERE h.id = $1 AND h.school_id = $2`, [req.params.id, a.schoolId],
    );
    if (!hw) throw new AppError(404, 'NOT_FOUND', 'Homework not found.');
    if (a.role === 'student') {
      const sc = await studentClass(a.schoolId, a.linkedStudentId!);
      if (!sc || sc.classId !== hw.classId || (hw.sectionId && sc.sectionId !== hw.sectionId)) {
        throw new AppError(403, 'FORBIDDEN', 'This homework is not assigned to your class.');
      }
      const mine = await one(
        `SELECT id, submitted_at AS "submittedAt", text, status, feedback, score,
                (file_path <> '') AS "hasFile"
         FROM homework_submissions WHERE homework_id = $1 AND student_id = $2`,
        [hw.id, a.linkedStudentId],
      );
      res.json({ data: { ...hw, mySubmission: mine } });
      return;
    }
    res.json({ data: hw });
  } catch (err) {
    next(err);
  }
});

router.post('/homework', requirePerm(PERMISSIONS.homeworkCreate), validateBody(z.object({
  classId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  subjectId: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().max(4000).optional().default(''),
  assignedDate: dateString,
  dueDate: dateString,
})), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as Record<string, string>;
    const cls = await one(`SELECT id FROM classes WHERE id = $1 AND school_id = $2`, [b.classId, a.schoolId]);
    if (!cls) throw new AppError(422, 'VALIDATION_ERROR', 'Class does not exist.');
    const row = await one<{ id: string }>(
      `INSERT INTO homework (id, school_id, class_id, section_id, subject_id, title, description,
        assigned_date, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [randomUUID(), a.schoolId, b.classId, b.sectionId ?? null, b.subjectId, b.title,
        b.description ?? '', b.assignedDate, b.dueDate, a.userId],
    );
    res.status(201).json({ data: { id: row!.id } });
  } catch (err) {
    next(err);
  }
});

router.patch('/homework/:id', requirePerm(PERMISSIONS.homeworkEdit), validateBody(z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).optional(),
  dueDate: dateString.optional(),
  status: z.enum(['active', 'closed']).optional(),
}).partial()), async (req, res, next) => {
  try {
    const a = auth(req);
    const hw = await one<{ createdBy: string }>(
      `SELECT created_by AS "createdBy" FROM homework WHERE id = $1 AND school_id = $2`, [req.params.id, a.schoolId],
    );
    if (!hw) throw new AppError(404, 'NOT_FOUND', 'Homework not found.');
    if (a.role !== 'admin' && hw.createdBy !== a.userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the assigning teacher (or admin) can edit this homework.');
    }
    const b = req.body as Record<string, string>;
    const map: Record<string, string> = { title: 'title', description: 'description', dueDate: 'due_date', status: 'status' };
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [];
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { params.push(b[k]); sets.push(`${col} = $${params.length}`); }
    }
    params.push(req.params.id);
    await q(`UPDATE homework SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.post('/homework/:id/attachment', requirePerm(PERMISSIONS.homeworkEdit), upload.single('file'), async (req, res, next) => {
  try {
    const a = auth(req);
    const hw = await one<{ createdBy: string }>(
      `SELECT created_by AS "createdBy" FROM homework WHERE id = $1 AND school_id = $2`, [req.params.id, a.schoolId],
    );
    if (!hw) throw new AppError(404, 'NOT_FOUND', 'Homework not found.');
    if (a.role !== 'admin' && hw.createdBy !== a.userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the assigning teacher (or admin) can attach files.');
    }
    if (!req.file) throw new AppError(422, 'VALIDATION_ERROR', 'No file uploaded.');
    await q(`UPDATE homework SET attachment_path = $1, updated_at = NOW() WHERE id = $2`, [req.file.filename, req.params.id]);
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.get('/homework/:id/attachment', requirePerm(PERMISSIONS.homeworkView), async (req, res, next) => {
  try {
    const a = auth(req);
    const hw = await one<{ attachmentPath: string; classId: string; sectionId: string | null; title: string }>(
      `SELECT attachment_path AS "attachmentPath", class_id AS "classId",
              section_id AS "sectionId", title
       FROM homework WHERE id = $1 AND school_id = $2`, [req.params.id, a.schoolId],
    );
    if (!hw || !hw.attachmentPath) throw new AppError(404, 'NOT_FOUND', 'No attachment.');
    if (a.role === 'student') {
      const sc = await studentClass(a.schoolId, a.linkedStudentId!);
      if (!sc || sc.classId !== hw.classId) throw new AppError(403, 'FORBIDDEN', 'Not assigned to your class.');
    }
    downloadFile(res, hw.attachmentPath, `${hw.title}-attachment`, next);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------- submissions ------------------------------- */

router.get('/homework/:id/submissions', requirePerm(PERMISSIONS.homeworkView), async (req, res, next) => {
  try {
    const a = auth(req);
    const hw = await one(`SELECT id FROM homework WHERE id = $1 AND school_id = $2`, [req.params.id, a.schoolId]);
    if (!hw) throw new AppError(404, 'NOT_FOUND', 'Homework not found.');
    if (a.role === 'student') {
      const mine = await q(
        `SELECT id, submitted_at AS "submittedAt", text, status, feedback, score,
                (file_path <> '') AS "hasFile"
         FROM homework_submissions WHERE homework_id = $1 AND student_id = $2`,
        [req.params.id, a.linkedStudentId],
      );
      res.json({ data: mine });
      return;
    }
    if (a.role !== 'admin' && a.role !== 'teacher') throw new AppError(403, 'FORBIDDEN', 'Not allowed.');
    const rows = await q(
      `SELECT hs.id, hs.student_id AS "studentId", hs.submitted_at AS "submittedAt",
              hs.text, hs.status, hs.feedback, hs.score, (hs.file_path <> '') AS "hasFile",
              TRIM(s.first_name || ' ' || s.last_name) AS "studentName", s.roll_no AS "rollNo"
       FROM homework_submissions hs JOIN students s ON s.id = hs.student_id
       WHERE hs.homework_id = $1 ORDER BY hs.submitted_at DESC`,
      [req.params.id],
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/homework/:id/submissions', requirePerm(PERMISSIONS.homeworkSubmit), upload.single('file'), async (req, res, next) => {
  try {
    const a = auth(req);
    if (a.role !== 'student' || !a.linkedStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Only student accounts can submit homework.');
    }
    const hw = await one<{ status: string }>(
      `SELECT status FROM homework WHERE id = $1 AND school_id = $2`, [req.params.id, a.schoolId],
    );
    if (!hw) throw new AppError(404, 'NOT_FOUND', 'Homework not found.');
    if (hw.status === 'closed') throw new AppError(422, 'VALIDATION_ERROR', 'Submissions are closed for this homework.');
    const text = String((req.body as Record<string, unknown>)?.text ?? '').slice(0, 4000);
    if (!text && !req.file) throw new AppError(422, 'VALIDATION_ERROR', 'Submit text, a file, or both.');
    await q(
      `INSERT INTO homework_submissions (id, homework_id, student_id, submitted_at, text, file_path, status)
       VALUES ($1,$2,$3,NOW(),$4,$5,'submitted')
       ON CONFLICT (homework_id, student_id)
       DO UPDATE SET text = EXCLUDED.text,
                     file_path = CASE WHEN EXCLUDED.file_path <> '' THEN EXCLUDED.file_path ELSE homework_submissions.file_path END,
                     submitted_at = NOW(), status = 'submitted'`,
      [randomUUID(), req.params.id, a.linkedStudentId, text, req.file?.filename ?? ''],
    );
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.patch('/submissions/:id', requirePerm(PERMISSIONS.homeworkEdit), validateBody(z.object({
  feedback: z.string().max(2000).optional(),
  score: z.number().min(0).max(10000).nullable().optional(),
  status: z.enum(['submitted', 'reviewed', 'returned']).optional(),
}).partial()), async (req, res, next) => {
  try {
    const sub = await one<{ homeworkId: string }>(
      `SELECT hs.homework_id AS "homeworkId" FROM homework_submissions hs
       JOIN homework h ON h.id = hs.homework_id
       WHERE hs.id = $1 AND h.school_id = $2`,
      [req.params.id, auth(req).schoolId],
    );
    if (!sub) throw new AppError(404, 'NOT_FOUND', 'Submission not found.');
    const b = req.body as Record<string, string | number | null>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
    if (b.feedback !== undefined) put('feedback', b.feedback);
    if (b.score !== undefined) put('score', b.score);
    if (b.status !== undefined) put('status', b.status);
    if (sets.length === 0) { res.json({ data: { ok: true } }); return; }
    params.push(req.params.id);
    await q(`UPDATE homework_submissions SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.get('/submissions/:id/file', requirePerm(PERMISSIONS.homeworkView), async (req, res, next) => {
  try {
    const a = auth(req);
    const sub = await one<{ filePath: string; studentId: string }>(
      `SELECT hs.file_path AS "filePath", hs.student_id AS "studentId"
       FROM homework_submissions hs JOIN homework h ON h.id = hs.homework_id
       WHERE hs.id = $1 AND h.school_id = $2`,
      [req.params.id, a.schoolId],
    );
    if (!sub || !sub.filePath) throw new AppError(404, 'NOT_FOUND', 'No file attached.');
    if (a.role === 'student' && sub.studentId !== a.linkedStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Not your submission.');
    }
    downloadFile(res, sub.filePath, 'submission', next);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- materials -------------------------------- */

router.get('/materials', requirePerm(PERMISSIONS.materialsView), async (req, res, next) => {
  try {
    const a = auth(req);
    const { classId, subjectId, kind } = req.query as Record<string, string | undefined>;
    const params: unknown[] = [a.schoolId];
    const where = ['m.school_id = $1'];
    if (a.role === 'student') {
      const sc = a.linkedStudentId ? await studentClass(a.schoolId, a.linkedStudentId) : null;
      if (sc?.classId) { params.push(sc.classId); where.push(`(m.class_id IS NULL OR m.class_id = $${params.length})`); }
    } else if (classId) {
      params.push(classId); where.push(`m.class_id = $${params.length}`);
    }
    if (subjectId) { params.push(subjectId); where.push(`m.subject_id = $${params.length}`); }
    if (kind) { params.push(kind); where.push(`m.kind = $${params.length}`); }
    const rows = await q(
      `SELECT m.id, m.class_id AS "classId", m.subject_id AS "subjectId", m.title, m.kind,
              m.description, m.url, m.file_name AS "fileName", m.mime_type AS "mimeType",
              m.size_bytes AS "sizeBytes", (m.file_path <> '') AS "hasFile",
              m.uploaded_by AS "uploadedBy", m.created_at AS "createdAt",
              c.name AS "className", s.name AS "subjectName"
       FROM materials m
       LEFT JOIN classes c ON c.id = m.class_id
       LEFT JOIN subjects s ON s.id = m.subject_id
       WHERE ${where.join(' AND ')} ORDER BY m.created_at DESC LIMIT 200`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/materials', requirePerm(PERMISSIONS.materialsCreate), upload.single('file'), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = (req.body ?? {}) as Record<string, string>;
    const parsed = z.object({
      classId: z.string().nullable().optional(),
      subjectId: z.string().nullable().optional(),
      title: z.string().min(1).max(160),
      kind: z.enum(['document', 'video', 'link', 'audio', 'other']).optional().default('document'),
      description: z.string().max(2000).optional().default(''),
      url: z.string().max(500).optional().default(''),
    }).safeParse(b);
    if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid material fields', parsed.error.flatten());
    const m = parsed.data;
    if (!req.file && !m.url) throw new AppError(422, 'VALIDATION_ERROR', 'Attach a file or provide a URL.');
    const row = await one<{ id: string }>(
      `INSERT INTO materials (id, school_id, class_id, subject_id, title, kind, description, url,
        file_path, file_name, mime_type, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [randomUUID(), a.schoolId, m.classId || null, m.subjectId || null, m.title, m.kind, m.description, m.url,
        req.file?.filename ?? '', req.file?.originalname ?? '', req.file?.mimetype ?? '',
        req.file?.size ?? 0, a.userId],
    );
    res.status(201).json({ data: { id: row!.id } });
  } catch (err) {
    next(err);
  }
});

router.get('/materials/:id/download', requirePerm(PERMISSIONS.materialsView), async (req, res, next) => {
  try {
    const mat = await one<{ filePath: string; fileName: string }>(
      `SELECT file_path AS "filePath", file_name AS "fileName"
       FROM materials WHERE id = $1 AND school_id = $2`,
      [req.params.id, auth(req).schoolId],
    );
    if (!mat || !mat.filePath) throw new AppError(404, 'NOT_FOUND', 'No file attached.');
    downloadFile(res, mat.filePath, mat.fileName || 'material', next);
  } catch (err) {
    next(err);
  }
});
