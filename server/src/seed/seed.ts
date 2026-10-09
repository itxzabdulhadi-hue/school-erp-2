/**
 * Demo seed: one school + users + a coherent dataset for the mobile apps.
 * Usage: `npm run seed` (additive) or `npm run seed:fresh` (wipes the demo school first).
 * Demo password comes from DEMO_SEED_PASSWORD (default School@123) — dev only.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { hashPassword } from '../auth/password';
import { config } from '../config';
import { setPool } from '../db';
import { DEFAULT_SCALE } from '../lib/grading';
import { runMigrations } from '../migrate';

const SLUG = 'sunrise';
const id = (): string => randomUUID();
const today = new Date();
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (n: number): string => iso(new Date(today.getTime() + n * 86400000));
const firstNames = ['Ahmed', 'Ayesha', 'Bilal', 'Fatima', 'Usman', 'Zainab', 'Hamza', 'Maryam', 'Ali', 'Sana', 'Omar', 'Hira'];
const lastNames = ['Khan', 'Ahmed', 'Raza', 'Malik', 'Sheikh', 'Qureshi', 'Butt', 'Chaudhry', 'Farooq', 'Iqbal'];

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: config.databaseUrl });
  setPool(pool);
  await runMigrations();
  // eslint-disable-next-line no-console
  const log = console.log;

  if (process.argv.includes('--fresh')) {
    await pool.query(`DELETE FROM schools WHERE slug = $1`, [SLUG]);
    log('Wiped existing demo school.');
  }
  const existing = await pool.query(`SELECT id FROM schools WHERE slug = $1`, [SLUG]);
  if (existing.rows.length > 0 && !process.argv.includes('--fresh')) {
    log('Demo school already seeded. Use --fresh to reseed.');
    await pool.end();
    return;
  }

  const passwordHash = await hashPassword(config.demoSeedPassword);
  const schoolId = id();
  await pool.query(
    `INSERT INTO schools (id, slug, name, tagline, primary_color, accent_color, currency,
      currency_symbol, date_format, timezone, language, grading_scale, settings)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [schoolId, SLUG, 'Sunrise Academy', 'Learn. Grow. Excel.', '#1d4ed8', '#0ea5e9', 'PKR', 'Rs',
      'DD/MM/YYYY', 'Asia/Karachi', 'en', JSON.stringify(DEFAULT_SCALE),
      JSON.stringify({ academicYear: '2026-27', currentTerm: 'First Term' })],
  );

  // Classes, sections, subjects
  const classIds: string[] = [];
  const sectionByClass = new Map<string, string>();
  const classNames = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
  for (let i = 0; i < classNames.length; i++) {
    const c = id();
    classIds.push(c);
    await pool.query(
      `INSERT INTO classes (id, school_id, name, numeric_order, room) VALUES ($1,$2,$3,$4,$5)`,
      [c, schoolId, classNames[i], i + 6, `R-${i + 1}01`],
    );
    const s = id();
    sectionByClass.set(c, s);
    await pool.query(`INSERT INTO sections (id, school_id, class_id, name, capacity) VALUES ($1,$2,$3,'A',40)`,
      [s, schoolId, c]);
  }
  const subjectIds: string[] = [];
  const subjectNames: [string, string][] = [
    ['Mathematics', 'MATH'], ['English', 'ENG'], ['Science', 'SCI'],
    ['Urdu', 'URD'], ['Islamiat', 'ISL'], ['Computer Science', 'CS'],
  ];
  for (const [name, code] of subjectNames) {
    const s = id();
    subjectIds.push(s);
    await pool.query(`INSERT INTO subjects (id, school_id, name, code) VALUES ($1,$2,$3,$4)`, [s, schoolId, name, code]);
  }
  const teacherIds: string[] = [];
  const teacherNames: [string, string][] = [['Ayesha', 'Khan'], ['Bilal', 'Raza'], ['Sana', 'Malik'], ['Omar', 'Farooq']];
  for (let i = 0; i < teacherNames.length; i++) {
    const t = id();
    teacherIds.push(t);
    await pool.query(
      `INSERT INTO teachers (id, school_id, employee_code, first_name, last_name, phone, email, subject_ids, qualification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [t, schoolId, `TCH-${101 + i}`, teacherNames[i][0], teacherNames[i][1],
        `0300-1000${10 + i}`, `${teacherNames[i][0].toLowerCase()}@sunrise.edu`,
        JSON.stringify([subjectIds[i % subjectIds.length]]), 'M.A., B.Ed'],
    );
  }
  for (const c of classIds) {
    for (let i = 0; i < 4; i++) {
      await pool.query(
        `INSERT INTO class_subjects (id, class_id, subject_id, teacher_id, periods_per_week)
         VALUES ($1,$2,$3,$4,4)`,
        [id(), c, subjectIds[i], teacherIds[i % teacherIds.length]],
      );
    }
  }
  const staffIds: string[] = [];
  for (const [fn, ln, dept, desig] of [['Kamran', 'Ali', 'Admin', 'Accountant'], ['Nadia', 'Hussain', 'Library', 'Librarian']] as const) {
    const s = id();
    staffIds.push(s);
    await pool.query(
      `INSERT INTO staff (id, school_id, employee_code, first_name, last_name, phone, department, designation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s, schoolId, `STF-${201 + staffIds.length}`, fn, ln, '0300-200020', dept, desig],
    );
  }

  // Students (6 per class)
  const studentIds: string[] = [];
  let n = 0;
  for (const c of classIds) {
    for (let k = 0; k < 6; k++) {
      n += 1;
      const s = id();
      studentIds.push(s);
      await pool.query(
        `INSERT INTO students (id, school_id, student_id_code, admission_no, first_name, last_name,
          gender, dob, class_id, section_id, roll_no, phone, guardian, status, admission_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',$14)`,
        [s, schoolId, `STU-${String(n).padStart(4, '0')}`, `ADM-${String(1000 + n)}`,
          firstNames[n % firstNames.length], lastNames[(n * 3) % lastNames.length],
          n % 2 === 0 ? 'Female' : 'Male', `20${10 + (n % 6)}-0${(n % 9) + 1}-15`,
          c, sectionByClass.get(c), String(k + 1), '0300-300030',
          JSON.stringify({ name: 'Guardian', relation: 'Father', phone: '0300-400040' }), addDays(-200)],
      );
    }
  }

  // Users (demo logins)
  const mkUser = async (name: string, email: string, role: string, link: Record<string, string | null>): Promise<void> => {
    await pool.query(
      `INSERT INTO users (id, school_id, name, email, password_hash, role,
        linked_student_id, linked_teacher_id, linked_staff_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id(), schoolId, name, email, passwordHash, role, link.student ?? null, link.teacher ?? null, link.staff ?? null],
    );
  };
  await mkUser('Farhan Mehmood (Admin)', 'admin@sunrise.edu', 'admin', {});
  await mkUser('Ayesha Khan', 'ayesha.khan@sunrise.edu', 'teacher', { teacher: teacherIds[0] });
  await mkUser('Ahmed Raza', 'student@sunrise.edu', 'student', { student: studentIds[0] });
  await mkUser('Kamran Ali', 'kamran.ali@sunrise.edu', 'staff', { staff: staffIds[0] });

  // Timetable (Mon–Fri, 4 periods/day per class)
  const days = [1, 2, 3, 4, 5];
  const slots: [string, string][] = [['08:00', '08:45'], ['08:50', '09:35'], ['09:50', '10:35'], ['10:40', '11:25']];
  for (const c of classIds) {
    for (const d of days) {
      for (let p = 0; p < slots.length; p++) {
        await pool.query(
          `INSERT INTO timetable_slots (id, school_id, class_id, section_id, subject_id, teacher_id,
            day_of_week, start_time, end_time, room)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id(), schoolId, c, sectionByClass.get(c), subjectIds[(p + d) % 4],
            teacherIds[(p + d) % teacherIds.length], d, slots[p][0], slots[p][1], `R-${p + 1}0${d}`],
        );
      }
    }
  }

  // Exam + schedules + marks
  const examId = id();
  await pool.query(
    `INSERT INTO exams (id, school_id, name, term, academic_year, start_date, end_date, status)
     VALUES ($1,$2,'First Term Examination','First Term','2026-27',$3,$4,'completed')`,
    [examId, schoolId, addDays(-20), addDays(-10)],
  );
  for (const c of classIds) {
    for (let i = 0; i < 4; i++) {
      const sch = id();
      await pool.query(
        `INSERT INTO exam_schedules (id, exam_id, class_id, subject_id, date, start_time, end_time, max_marks, passing_marks)
         VALUES ($1,$2,$3,$4,$5,'09:00','12:00',100,40)`,
        [sch, examId, c, subjectIds[i], addDays(-20 + i)],
      );
      const pupils = await pool.query(`SELECT id FROM students WHERE class_id = $1`, [c]);
      for (const [idx, row] of pupils.rows.entries()) {
        const score = 55 + ((idx * 7 + i * 11) % 40);
        await pool.query(
          `INSERT INTO marks (id, exam_id, schedule_id, student_id, subject_id, obtained_marks, max_marks)
           VALUES ($1,$2,$3,$4,$5,$6,100)`,
          [id(), examId, sch, row.id as string, subjectIds[i], score],
        );
      }
    }
  }

  // Attendance (past 10 weekdays)
  let past = 1;
  let done = 0;
  while (done < 10 && past < 30) {
    const d = new Date(today.getTime() - past * 86400000);
    past += 1;
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    done += 1;
    for (const [idx, s] of studentIds.entries()) {
      const r = (idx * 13 + done * 7) % 100;
      const status = r < 86 ? 'present' : r < 92 ? 'late' : r < 96 ? 'absent' : 'leave';
      const cls = await pool.query(`SELECT class_id, section_id FROM students WHERE id = $1`, [s]);
      await pool.query(
        `INSERT INTO attendance_records (id, school_id, person_type, student_id, date, class_id, section_id, status)
         VALUES ($1,$2,'student',$3,$4,$5,$6,$7)`,
        [id(), schoolId, s, iso(d), cls.rows[0].class_id, cls.rows[0].section_id, status],
      );
    }
  }

  // Fees
  const feeTypeIds: string[] = [];
  for (const [name, freq, amount] of [['Tuition Fee', 'monthly', 8000], ['Transport Fee', 'monthly', 2500], ['Exam Fee', 'one-time', 1500]] as const) {
    const f = id();
    feeTypeIds.push(f);
    await pool.query(`INSERT INTO fee_types (id, school_id, name, frequency, amount) VALUES ($1,$2,$3,$4,$5)`,
      [f, schoolId, name, freq, amount]);
  }
  let invN = 0;
  for (const [idx, s] of studentIds.entries()) {
    invN += 1;
    const inv = id();
    const total = 10500;
    await pool.query(
      `INSERT INTO invoices (id, school_id, invoice_no, student_id, title, issue_date, due_date,
        subtotal, discount, tax, total, paid, status)
       VALUES ($1,$2,$3,$4,'October 2026 Fee',$5,$6,$7,0,0,$7,$8,$9)`,
      [inv, schoolId, `INV-2026-${String(invN).padStart(4, '0')}`, s, addDays(-12), addDays(3),
        total, idx % 3 === 2 ? 0 : total, idx % 3 === 2 ? 'unpaid' : 'paid'],
    );
    await pool.query(
      `INSERT INTO invoice_lines (id, invoice_id, fee_type_id, label, qty, amount) VALUES ($1,$2,$3,'Tuition Fee',1,8000)`,
      [id(), inv, feeTypeIds[0]],
    );
    await pool.query(
      `INSERT INTO invoice_lines (id, invoice_id, fee_type_id, label, qty, amount) VALUES ($1,$2,$3,'Transport Fee',1,2500)`,
      [id(), inv, feeTypeIds[1]],
    );
    if (idx % 3 !== 2) {
      await pool.query(
        `INSERT INTO payments (id, school_id, invoice_id, student_id, receipt_no, amount, method, payment_date, received_by)
         VALUES ($1,$2,$3,$4,$5,$6,'cash',$7,'Front Office')`,
        [id(), schoolId, inv, s, `RCP-2026-${String(invN).padStart(4, '0')}`, total, addDays(-9)],
      );
    }
  }

  // Homework + submissions + materials
  for (const c of classIds.slice(0, 2)) {
    const hw = id();
    await pool.query(
      `INSERT INTO homework (id, school_id, class_id, section_id, subject_id, title, description, assigned_date, due_date, status)
       VALUES ($1,$2,$3,$4,$5,'Chapter 5 exercises','Complete exercises 5.1–5.4 in your notebook.',$6,$7,'active')`,
      [hw, schoolId, c, sectionByClass.get(c), subjectIds[0], addDays(-3), addDays(2)],
    );
    const pupils = await pool.query(`SELECT id FROM students WHERE class_id = $1 LIMIT 3`, [c]);
    for (const row of pupils.rows) {
      await pool.query(
        `INSERT INTO homework_submissions (id, homework_id, student_id, text, status) VALUES ($1,$2,$3,'Done. See notebook.','submitted')`,
        [id(), hw, row.id as string],
      );
    }
  }
  await pool.query(
    `INSERT INTO materials (id, school_id, class_id, subject_id, title, kind, description, url)
     VALUES ($1,$2,$3,$4,'Fractions — video lesson','video','Visual introduction to fractions.','https://example.com/fractions')`,
    [id(), schoolId, classIds[0], subjectIds[0]],
  );

  // Sample upload file referenced by a school document
  const uploadDir = join(process.cwd(), config.uploadDir);
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  const sampleName = `sample-handbook-${Date.now()}.txt`;
  writeFileSync(join(uploadDir, sampleName), 'Sunrise Academy — Parent & Student Handbook (sample file for the mobile demo).\n');
  await pool.query(
    `INSERT INTO documents (id, school_id, owner_type, title, kind, description, file_path, file_name, mime_type, size_bytes)
     VALUES ($1,$2,'school','Parent & Student Handbook','policy','School rules and calendar.', $3,'handbook.txt','text/plain',120)`,
    [id(), schoolId, sampleName],
  );

  // Announcements, events, welcome notifications
  await pool.query(
    `INSERT INTO announcements (id, school_id, title, body, audience, publish_date, priority)
     VALUES ($1,$2,'Parent–Teacher Meeting','PTM for all classes on Saturday from 9am to 12pm.','all',$3,'high')`,
    [id(), schoolId, addDays(-1)],
  );
  await pool.query(
    `INSERT INTO announcements (id, school_id, title, body, audience, publish_date, priority)
     VALUES ($1,$2,'Winter uniform from Monday','Students must switch to winter uniform starting next Monday.','student',$3,'normal')`,
    [id(), schoolId, addDays(-2)],
  );
  await pool.query(
    `INSERT INTO events (id, school_id, title, description, date, start_time, end_time, location, audience)
     VALUES ($1,$2,'Annual Sports Day','March-past, athletics finals and prize distribution.',$3,'09:00','15:00','Main Ground','all')`,
    [id(), schoolId, addDays(12)],
  );
  const users = await pool.query(`SELECT id FROM users WHERE school_id = $1`, [schoolId]);
  for (const row of users.rows) {
    await pool.query(
      `INSERT INTO notifications (id, school_id, user_id, audience, title, body, kind)
       VALUES ($1,$2,$3,'all','Welcome to Sunrise Academy mobile','Your ERP account is ready.','info')`,
      [id(), schoolId, row.id as string],
    );
  }

  log(`Seeded demo school "${SLUG}" (${studentIds.length} students).`);
  log(`Demo logins (password: ${config.demoSeedPassword}): admin@sunrise.edu, ayesha.khan@sunrise.edu, student@sunrise.edu, kamran.ali@sunrise.edu`);
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
