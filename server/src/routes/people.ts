import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/password';
import { PERMISSIONS, ROLES, requirePerm } from '../auth/permissions';
import { one, q } from '../db';
import { authenticate, type AuthContext } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { dateString, validateBody, validateQuery } from '../middleware/validate';

export const router = Router();
router.use(authenticate);

const auth = (req: { auth?: AuthContext }): AuthContext => {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.auth;
};

const STUDENT_COLS = `s.id, s.school_id AS "schoolId", s.student_id_code AS "studentIdCode",
  s.admission_no AS "admissionNo", s.first_name AS "firstName", s.last_name AS "lastName",
  s.gender, s.dob, s.class_id AS "classId", s.section_id AS "sectionId", s.roll_no AS "rollNo",
  s.phone, s.email, s.address, s.guardian, s.status, s.admission_date AS "admissionDate",
  s.archived, c.name AS "className", sec.name AS "sectionName"`;

const studentFrom = `FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN sections sec ON sec.id = s.section_id`;

/** Students: role-students are strictly scoped to their own record. */
router.get('/students', requirePerm(PERMISSIONS.studentsView), async (req, res, next) => {
  try {
    const a = auth(req);
    if (a.role === 'student') {
      if (!a.linkedStudentId) throw new AppError(403, 'FORBIDDEN', 'No student profile linked to this account.');
      const self = await one(
        `SELECT ${STUDENT_COLS} ${studentFrom} WHERE s.id = $1 AND s.school_id = $2`,
        [a.linkedStudentId, a.schoolId],
      );
      res.json({ data: self ? [self] : [] });
      return;
    }
    const { classId, sectionId, status, search } = req.query as Record<string, string | undefined>;
    const params: unknown[] = [a.schoolId];
    const where = ['s.school_id = $1', 's.archived = FALSE'];
    if (classId) { params.push(classId); where.push(`s.class_id = $${params.length}`); }
    if (sectionId) { params.push(sectionId); where.push(`s.section_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`s.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.admission_no ILIKE $${params.length} OR s.student_id_code ILIKE $${params.length})`);
    }
    const rows = await q(
      `SELECT ${STUDENT_COLS} ${studentFrom} WHERE ${where.join(' AND ')}
       ORDER BY s.first_name, s.last_name LIMIT 500`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/students/:id', requirePerm(PERMISSIONS.studentsView), async (req, res, next) => {
  try {
    const a = auth(req);
    if (a.role === 'student' && req.params.id !== a.linkedStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Students can only view their own profile.');
    }
    const row = await one(
      `SELECT ${STUDENT_COLS} ${studentFrom} WHERE s.id = $1 AND s.school_id = $2`,
      [req.params.id, a.schoolId],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Student not found.');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

const studentSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  gender: z.string().max(20).optional().default(''),
  dob: dateString.optional(),
  classId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  rollNo: z.string().max(20).optional().default(''),
  phone: z.string().max(30).optional().default(''),
  email: z.string().email().max(160).optional().default(''),
  address: z.string().max(300).optional().default(''),
  guardian: z.record(z.unknown()).optional().default({}),
  status: z.enum(['active', 'inactive', 'alumni', 'suspended']).optional().default('active'),
  admissionNo: z.string().max(30).optional(),
  studentIdCode: z.string().max(30).optional(),
});

async function nextCode(prefix: string, schoolId: string): Promise<string> {
  const row = await one<{ count: number }>(`SELECT COUNT(*)::int AS count FROM students WHERE school_id = $1`, [schoolId]);
  return `${prefix}-${String((row?.count ?? 0) + 1).padStart(4, '0')}`;
}

router.post('/students', requirePerm(PERMISSIONS.studentsCreate), validateBody(studentSchema), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as z.infer<typeof studentSchema>;
    const cls = await one(`SELECT id FROM classes WHERE id = $1 AND school_id = $2`, [b.classId, a.schoolId]);
    if (!cls) throw new AppError(422, 'VALIDATION_ERROR', 'Class does not exist.');
    if (b.sectionId) {
      const sec = await one(`SELECT id FROM sections WHERE id = $1 AND class_id = $2`, [b.sectionId, b.classId]);
      if (!sec) throw new AppError(422, 'VALIDATION_ERROR', 'Section does not belong to the class.');
    }
    const row = await one(
      `INSERT INTO students (id, school_id, student_id_code, admission_no, first_name, last_name, gender,
        dob, class_id, section_id, roll_no, phone, email, address, guardian, status, admission_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_DATE)
       RETURNING id`,
      [randomUUID(), a.schoolId, b.studentIdCode ?? await nextCode('STU', a.schoolId),
        b.admissionNo ?? await nextCode('ADM', a.schoolId), b.firstName, b.lastName, b.gender,
        b.dob ?? null, b.classId, b.sectionId ?? null, b.rollNo, b.phone, b.email, b.address,
        JSON.stringify(b.guardian), b.status],
    );
    const created = await one(`SELECT ${STUDENT_COLS} ${studentFrom} WHERE s.id = $1`, [(row as { id: string }).id]);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/students/:id', requirePerm(PERMISSIONS.studentsEdit), validateBody(studentSchema.partial()), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as Partial<z.infer<typeof studentSchema>>;
    const existing = await one(`SELECT id FROM students WHERE id = $1 AND school_id = $2`, [req.params.id, a.schoolId]);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Student not found.');
    if (b.classId) {
      const cls = await one(`SELECT id FROM classes WHERE id = $1 AND school_id = $2`, [b.classId, a.schoolId]);
      if (!cls) throw new AppError(422, 'VALIDATION_ERROR', 'Class does not exist.');
    }
    const map: Record<string, string> = {
      firstName: 'first_name', lastName: 'last_name', gender: 'gender', dob: 'dob',
      classId: 'class_id', sectionId: 'section_id', rollNo: 'roll_no', phone: 'phone',
      email: 'email', address: 'address', status: 'status',
    };
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    for (const [k, col] of Object.entries(map)) {
      const v = (b as Record<string, unknown>)[k];
      if (v !== undefined) { params.push(v); sets.push(`${col} = $${params.length}`); }
    }
    if (b.guardian !== undefined) { params.push(JSON.stringify(b.guardian)); sets.push(`guardian = $${params.length}`); }
    params.push(req.params.id);
    await q(`UPDATE students SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    const updated = await one(`SELECT ${STUDENT_COLS} ${studentFrom} WHERE s.id = $1`, [req.params.id]);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------- teachers ---------------------------------- */

const TEACHER_COLS = `id, school_id AS "schoolId", employee_code AS "employeeCode",
  first_name AS "firstName", last_name AS "lastName", gender, phone, email,
  subject_ids AS "subjectIds", qualification, joining_date AS "joiningDate", status`;

router.get('/teachers', requirePerm(PERMISSIONS.teachersView), async (req, res, next) => {
  try {
    const rows = await q(`SELECT ${TEACHER_COLS} FROM teachers WHERE school_id = $1 ORDER BY first_name, last_name`, [auth(req).schoolId]);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/teachers/:id', requirePerm(PERMISSIONS.teachersView), async (req, res, next) => {
  try {
    const row = await one(`SELECT ${TEACHER_COLS} FROM teachers WHERE id = $1 AND school_id = $2`, [req.params.id, auth(req).schoolId]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Teacher not found.');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- staff ----------------------------------- */

const STAFF_COLS = `id, school_id AS "schoolId", employee_code AS "employeeCode",
  first_name AS "firstName", last_name AS "lastName", gender, phone, email,
  department, designation, joining_date AS "joiningDate", status`;

router.get('/staff', requirePerm(PERMISSIONS.staffView), async (req, res, next) => {
  try {
    const rows = await q(`SELECT ${STAFF_COLS} FROM staff WHERE school_id = $1 ORDER BY first_name, last_name`, [auth(req).schoolId]);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/staff/:id', requirePerm(PERMISSIONS.staffView), async (req, res, next) => {
  try {
    const row = await one(`SELECT ${STAFF_COLS} FROM staff WHERE id = $1 AND school_id = $2`, [req.params.id, auth(req).schoolId]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Staff member not found.');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/* --------------------------- users (provisioning) --------------------------- */

const USER_PUBLIC = `id, school_id AS "schoolId", name, email, role,
  is_active AS "isActive", linked_student_id AS "linkedStudentId",
  linked_teacher_id AS "linkedTeacherId", linked_staff_id AS "linkedStaffId",
  created_at AS "createdAt"`;

router.get('/users', requirePerm(PERMISSIONS.usersView), async (req, res, next) => {
  try {
    const rows = await q(`SELECT ${USER_PUBLIC} FROM users WHERE school_id = $1 ORDER BY name`, [auth(req).schoolId]);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const userSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES),
  linkedStudentId: z.string().nullable().optional(),
  linkedTeacherId: z.string().nullable().optional(),
  linkedStaffId: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

router.post('/users', requirePerm(PERMISSIONS.usersManage), validateBody(userSchema), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as z.infer<typeof userSchema>;
    if (b.linkedStudentId) {
      const s = await one(`SELECT id FROM students WHERE id = $1 AND school_id = $2`, [b.linkedStudentId, a.schoolId]);
      if (!s) throw new AppError(422, 'VALIDATION_ERROR', 'Linked student does not exist.');
    }
    if (b.linkedTeacherId) {
      const t = await one(`SELECT id FROM teachers WHERE id = $1 AND school_id = $2`, [b.linkedTeacherId, a.schoolId]);
      if (!t) throw new AppError(422, 'VALIDATION_ERROR', 'Linked teacher does not exist.');
    }
    if (b.linkedStaffId) {
      const s = await one(`SELECT id FROM staff WHERE id = $1 AND school_id = $2`, [b.linkedStaffId, a.schoolId]);
      if (!s) throw new AppError(422, 'VALIDATION_ERROR', 'Linked staff member does not exist.');
    }
    const row = await one<{ id: string }>(
      `INSERT INTO users (id, school_id, name, email, password_hash, role,
        linked_student_id, linked_teacher_id, linked_staff_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [randomUUID(), a.schoolId, b.name, b.email, await hashPassword(b.password), b.role,
        b.linkedStudentId ?? null, b.linkedTeacherId ?? null, b.linkedStaffId ?? null, b.isActive],
    );
    const created = await one(`SELECT ${USER_PUBLIC} FROM users WHERE id = $1`, [row!.id]);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', requirePerm(PERMISSIONS.usersManage),
  validateBody(userSchema.partial().omit({ password: true }).extend({ password: z.string().min(8).max(200).optional() })),
  async (req, res, next) => {
    try {
      const a = auth(req);
      const b = req.body as Partial<z.infer<typeof userSchema>>;
      if (req.params.id === a.userId && b.isActive === false) {
        throw new AppError(422, 'VALIDATION_ERROR', 'You cannot deactivate your own account.');
      }
      const existing = await one(`SELECT id FROM users WHERE id = $1 AND school_id = $2`, [req.params.id, a.schoolId]);
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.');
      const sets = ['updated_at = NOW()'];
      const params: unknown[] = [];
      const put = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
      if (b.name !== undefined) put('name', b.name);
      if (b.role !== undefined) put('role', b.role);
      if (b.isActive !== undefined) put('is_active', b.isActive);
      if (b.linkedStudentId !== undefined) put('linked_student_id', b.linkedStudentId);
      if (b.linkedTeacherId !== undefined) put('linked_teacher_id', b.linkedTeacherId);
      if (b.linkedStaffId !== undefined) put('linked_staff_id', b.linkedStaffId);
      if (b.password) put('password_hash', await hashPassword(b.password));
      params.push(req.params.id);
      await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      const updated = await one(`SELECT ${USER_PUBLIC} FROM users WHERE id = $1`, [req.params.id]);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  });
