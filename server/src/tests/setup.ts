import { randomUUID } from 'crypto';
import type { Express } from 'express';
import { DataType, newDb } from 'pg-mem';
import request from 'supertest';
import { hashPassword } from '../auth/password';
import { setPool } from '../db';
import { DEFAULT_SCALE } from '../lib/grading';
import { runMigrations } from '../migrate';

export interface Fixtures {
  app: Express;
  schoolId: string;
  classId: string;
  sectionId: string;
  subjectIds: string[];
  teacherId: string;
  staffId: string;
  pupil1: string;
  pupil2: string;
  examId: string;
  scheduleId: string;
  invoiceUnpaid: string;
  homeworkId: string;
  tokens: Record<'admin' | 'teacher' | 'student' | 'staff', string>;
}

const id = (): string => randomUUID();

/** Build a fresh in-memory Postgres, migrate, and load a minimal coherent fixture set. */
export async function setupTestApp(): Promise<Fixtures> {
  const mem = newDb();
  // pg-mem omits TRIM(text); register a faithful copy so tests run the real SQL.
  mem.public.registerFunction({
    name: 'trim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (s: string | null) => (typeof s === 'string' ? s.trim() : s),
  });
  const { Pool } = mem.adapters.createPg();
  setPool(new Pool() as never);
  await runMigrations();
  const { createApp } = await import('../app');
  const app = createApp();

  const db = mem.public;
  const passwordHash = await hashPassword('School@123');
  const schoolId = id();
  await db.query(
    `INSERT INTO schools (id, slug, name, grading_scale) VALUES ('${schoolId}', 'test-school', 'Test School', '${JSON.stringify(DEFAULT_SCALE)}')`,
  );
  const classId = id();
  const sectionId = id();
  await db.query(`INSERT INTO classes (id, school_id, name, numeric_order) VALUES ('${classId}', '${schoolId}', 'Grade 6', 6)`);
  await db.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ('${sectionId}', '${schoolId}', '${classId}', 'A')`);
  const subjectIds = [id(), id()];
  await db.query(`INSERT INTO subjects (id, school_id, name, code) VALUES ('${subjectIds[0]}', '${schoolId}', 'Mathematics', 'MATH')`);
  await db.query(`INSERT INTO subjects (id, school_id, name, code) VALUES ('${subjectIds[1]}', '${schoolId}', 'English', 'ENG')`);
  const teacherId = id();
  await db.query(
    `INSERT INTO teachers (id, school_id, employee_code, first_name, last_name, email)
     VALUES ('${teacherId}', '${schoolId}', 'TCH-1', 'Test', 'Teacher', 'teacher@test.edu')`,
  );
  const staffId = id();
  await db.query(
    `INSERT INTO staff (id, school_id, employee_code, first_name, last_name, department, designation)
     VALUES ('${staffId}', '${schoolId}', 'STF-1', 'Test', 'Staff', 'Admin', 'Clerk')`,
  );
  const pupil1 = id();
  const pupil2 = id();
  for (const [p, fn, adm] of [[pupil1, 'Pupil', 'ADM-1'], [pupil2, 'Second', 'ADM-2']] as const) {
    await db.query(
      `INSERT INTO students (id, school_id, student_id_code, admission_no, first_name, last_name,
        class_id, section_id, status, admission_date)
       VALUES ('${p}', '${schoolId}', 'STU-${adm}', '${adm}', '${fn}', 'One', '${classId}', '${sectionId}', 'active', '2026-04-01')`,
    );
  }
  const mkUser = async (email: string, role: string, linkCol: string | null, linkId: string | null): Promise<void> => {
    await db.query(
      `INSERT INTO users (id, school_id, name, email, password_hash, role, ${linkCol ?? 'linked_student_id'})
       VALUES ('${id()}', '${schoolId}', '${role}', '${email}', '${passwordHash}', '${role}', ${linkId ? `'${linkId}'` : 'NULL'})`,
    );
  };
  await mkUser('admin@test.edu', 'admin', null, null);
  await mkUser('teacher@test.edu', 'teacher', 'linked_teacher_id', teacherId);
  await mkUser('student@test.edu', 'student', 'linked_student_id', pupil1);
  await mkUser('staff@test.edu', 'staff', 'linked_staff_id', staffId);

  const examId = id();
  await db.query(
    `INSERT INTO exams (id, school_id, name, term, start_date, end_date, status)
     VALUES ('${examId}', '${schoolId}', 'Mid Term', 'First', '2026-09-01', '2026-09-10', 'completed')`,
  );
  const scheduleId = id();
  await db.query(
    `INSERT INTO exam_schedules (id, exam_id, class_id, subject_id, date, start_time, end_time, max_marks, passing_marks)
     VALUES ('${scheduleId}', '${examId}', '${classId}', '${subjectIds[0]}', '2026-09-02', '09:00', '12:00', 100, 40)`,
  );
  await db.query(
    `INSERT INTO marks (id, exam_id, schedule_id, student_id, subject_id, obtained_marks, max_marks)
     VALUES ('${id()}', '${examId}', '${scheduleId}', '${pupil1}', '${subjectIds[0]}', 85, 100)`,
  );
  await db.query(
    `INSERT INTO marks (id, exam_id, schedule_id, student_id, subject_id, obtained_marks, max_marks)
     VALUES ('${id()}', '${examId}', '${scheduleId}', '${pupil2}', '${subjectIds[0]}', 62, 100)`,
  );
  const feeType = id();
  await db.query(`INSERT INTO fee_types (id, school_id, name, frequency, amount) VALUES ('${feeType}', '${schoolId}', 'Tuition', 'monthly', 5000)`);
  const invoiceUnpaid = id();
  await db.query(
    `INSERT INTO invoices (id, school_id, invoice_no, student_id, title, issue_date, due_date, subtotal, total, paid, status)
     VALUES ('${invoiceUnpaid}', '${schoolId}', 'INV-T-1', '${pupil1}', 'Fee', '2026-10-01', '2026-10-15', 5000, 5000, 0, 'unpaid')`,
  );
  await db.query(
    `INSERT INTO invoice_lines (id, invoice_id, fee_type_id, label, qty, amount)
     VALUES ('${id()}', '${invoiceUnpaid}', '${feeType}', 'Tuition Fee', 1, 5000)`,
  );
  const homeworkId = id();
  await db.query(
    `INSERT INTO homework (id, school_id, class_id, section_id, subject_id, title, assigned_date, due_date, status)
     VALUES ('${homeworkId}', '${schoolId}', '${classId}', '${sectionId}', '${subjectIds[0]}', 'Ex 1', '2026-10-05', '2026-10-12', 'active')`,
  );
  await db.query(
    `INSERT INTO announcements (id, school_id, title, body, audience, publish_date)
     VALUES ('${id()}', '${schoolId}', 'Hello', 'World', 'all', '2026-10-01')`,
  );

  const tokens = {} as Fixtures['tokens'];
  for (const role of ['admin', 'teacher', 'student', 'staff'] as const) {
    const res = await request(app).post('/api/v1/auth/login').send({ email: `${role}@test.edu`, password: 'School@123' });
    if (res.status !== 200) throw new Error(`fixture login failed for ${role}: ${res.status} ${JSON.stringify(res.body)}`);
    tokens[role] = (res.body as { data: { accessToken: string } }).data.accessToken;
  }
  return {
    app, schoolId, classId, sectionId, subjectIds, teacherId, staffId,
    pupil1, pupil2, examId, scheduleId, invoiceUnpaid, homeworkId, tokens,
  };
}

export const bearer = (token: string): string => `Bearer ${token}`;
