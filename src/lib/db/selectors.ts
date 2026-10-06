/**
 * Read-side query helpers. All dashboard metrics, reports and profile
 * aggregations live here so pages stay thin and computations stay testable.
 */
import { gradeFor } from '../grading';
import { addDaysISO, fullName, todayISO } from '../utils';
import type { DB } from './store';
import type {
  Invoice,
  StaffMember,
  Student,
  Teacher,
  TimetableSlot,
} from './types';

/* ------------------------------- lookups ---------------------------------- */

export const classById = (db: DB, id?: string): string =>
  db.classes.find((c) => c.id === id)?.name ?? '—';

export const sectionById = (db: DB, id?: string): string =>
  db.sections.find((s) => s.id === id)?.name ?? '';

export function classLabel(db: DB, classId?: string, sectionId?: string): string {
  const c = classById(db, classId);
  const s = sectionById(db, sectionId);
  return s ? `${c} · ${s}` : c;
}

export const studentName = (s?: Student): string =>
  s ? fullName(s.firstName, s.middleName, s.lastName) : '—';

export const teacherName = (t?: Teacher): string =>
  t ? `${t.firstName} ${t.lastName}` : '—';

export const staffName = (s?: StaffMember): string =>
  s ? `${s.firstName} ${s.lastName}` : '—';

export function employeeName(db: DB, kind: 'teacher' | 'staff' | undefined, id?: string): string {
  if (kind === 'teacher') return teacherName(db.teachers.find((t) => t.id === id));
  if (kind === 'staff') return staffName(db.staff.find((t) => t.id === id));
  return '—';
}

export function borrowerName(db: DB, type: 'student' | 'teacher' | 'staff', id: string): string {
  if (type === 'student') return studentName(db.students.find((s) => s.id === id));
  return employeeName(db, type, id);
}

export const subjectName = (db: DB, id?: string): string =>
  db.subjects.find((s) => s.id === id)?.name ?? '—';

export function studentsOfClass(db: DB, classId?: string, sectionId?: string, includeInactive = false): Student[] {
  return db.students.filter(
    (s) =>
      !s.archived &&
      (includeInactive || s.status === 'active') &&
      (!classId || s.classId === classId) &&
      (!sectionId || s.sectionId === sectionId),
  );
}

/* -------------------------------- numbers ---------------------------------- */

function nextNo(prefix: string, existing: string[]): string {
  let max = 0;
  existing.forEach((v) => {
    const m = /(\d+)\s*$/.exec(v);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

export const nextInvoiceNo = (db: DB): string => nextNo('INV', db.invoices.map((i) => i.invoiceNo));
export const nextReceiptNo = (db: DB): string => nextNo('RCPT', db.payments.map((p) => p.receiptNo));
export const nextCertNo = (db: DB): string => nextNo('CERT', db.certificates.map((c) => c.certNo));
export const nextStudentId = (db: DB): string => nextNo('STU', db.students.map((s) => s.studentId));
export const nextAdmissionNo = (db: DB): string =>
  `ADM-${new Date().getFullYear()}-${String(db.students.length + 1).padStart(3, '0')}`;
export const nextEmployeeId = (db: DB, kind: 'T' | 'S'): string =>
  nextNo(`EMP-${kind}`, [...db.teachers, ...db.staff].map((e) => e.employeeId));

/* -------------------------------- attendance -------------------------------- */

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  pct: number;
}

const emptyStats = (): AttendanceStats => ({ total: 0, present: 0, absent: 0, late: 0, excused: 0, pct: 0 });

export function studentAttendanceStats(db: DB, studentId: string, from?: string, to?: string): AttendanceStats {
  const recs = db.attendance.filter(
    (a) =>
      a.personType === 'student' &&
      a.studentId === studentId &&
      (!from || a.date >= from) &&
      (!to || a.date <= to),
  );
  return summarize(recs.map((r) => r.status));
}

function summarize(statuses: string[]): AttendanceStats {
  const s = emptyStats();
  s.total = statuses.length;
  statuses.forEach((st) => {
    if (st === 'present' || st === 'half-day') s.present++;
    else if (st === 'absent' || st === 'leave') s.absent++;
    else if (st === 'late') s.late++;
    else s.excused++;
  });
  const effective = s.present + s.late * 0.5 + s.excused * 0.5;
  s.pct = s.total ? Math.round((effective / s.total) * 1000) / 10 : 0;
  return s;
}

export function dayAttendance(db: DB, date: string): AttendanceStats {
  return summarize(
    db.attendance.filter((a) => a.date === date && a.personType === 'student').map((r) => r.status),
  );
}

export function staffDayAttendance(db: DB, date: string): AttendanceStats {
  return summarize(
    db.attendance.filter((a) => a.date === date && a.personType === 'employee').map((r) => r.status),
  );
}

export function attendanceTrend(db: DB, days = 14): { date: string; pct: number; present: number; absent: number }[] {
  const out: { date: string; pct: number; present: number; absent: number }[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = addDaysISO(todayISO(), -d);
    const s = dayAttendance(db, date);
    out.push({ date: date.slice(5), pct: s.pct, present: s.present, absent: s.absent });
  }
  return out;
}

export function lowAttendanceStudents(db: DB, threshold = 75, days = 30): { student: Student; pct: number }[] {
  const from = addDaysISO(todayISO(), -days);
  return db.students
    .filter((s) => s.status === 'active' && !s.archived)
    .map((student) => ({ student, pct: studentAttendanceStats(db, student.id, from).pct }))
    .filter((x) => x.pct < threshold)
    .sort((a, b) => a.pct - b.pct);
}

/* --------------------------------- finance ---------------------------------- */

export const invoiceBalance = (inv: Invoice): number => Math.max(0, inv.total - inv.paid);

export function studentOutstanding(db: DB, studentId: string): number {
  return db.invoices
    .filter((i) => i.studentId === studentId && i.status !== 'cancelled' && i.status !== 'paid')
    .reduce((a, i) => a + invoiceBalance(i), 0);
}

export interface FinanceSummary {
  collected: number;
  outstanding: number;
  overdue: number;
  discounts: number;
  fines: number;
  invoiced: number;
  count: number;
}

export function financeSummary(db: DB, from?: string, to?: string): FinanceSummary {
  const inRange = (d: string): boolean => (!from || d >= from) && (!to || d <= to);
  const pays = db.payments.filter((p) => inRange(p.paymentDate));
  const invs = db.invoices.filter((i) => i.status !== 'cancelled');
  return {
    collected: pays.reduce((a, p) => a + p.amount, 0),
    outstanding: invs.reduce((a, i) => a + invoiceBalance(i), 0),
    overdue: invs.filter((i) => i.status === 'overdue').reduce((a, i) => a + invoiceBalance(i), 0),
    discounts: invs.filter((i) => inRange(i.issueDate)).reduce((a, i) => a + i.discount, 0),
    fines: invs.filter((i) => inRange(i.issueDate)).reduce((a, i) => a + i.fine, 0),
    invoiced: invs.filter((i) => inRange(i.issueDate)).reduce((a, i) => a + i.total, 0),
    count: pays.length,
  };
}

export function feeCollectionTrend(db: DB, days = 14): { date: string; amount: number }[] {
  const out: { date: string; amount: number }[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = addDaysISO(todayISO(), -d);
    const amount = db.payments.filter((p) => p.paymentDate === date).reduce((a, p) => a + p.amount, 0);
    out.push({ date: date.slice(5), amount });
  }
  return out;
}

export function collectionByMethod(db: DB): { method: string; amount: number }[] {
  const map = new Map<string, number>();
  db.payments.forEach((p) => map.set(p.method, (map.get(p.method) ?? 0) + p.amount));
  return [...map.entries()].map(([method, amount]) => ({ method, amount }));
}

export const overdueInvoices = (db: DB): Invoice[] =>
  db.invoices.filter((i) => i.status === 'overdue').sort((a, b) => a.dueDate.localeCompare(b.dueDate));

/* -------------------------------- academics --------------------------------- */

export interface StudentResultRow {
  student: Student;
  subjects: { subjectId: string; obtained: number; max: number; absent: boolean }[];
  total: number;
  max: number;
  pct: number;
  grade: string;
  gpa: number | null;
  passed: boolean;
  rank: number;
}

export function examResults(db: DB, examId: string, classId?: string): StudentResultRow[] {
  const pupils = studentsOfClass(db, classId);
  const rows: StudentResultRow[] = pupils.map((student) => {
    const marks = db.marks.filter((m) => m.examId === examId && m.studentId === student.id);
    const subjects = marks.map((m) => ({ subjectId: m.subjectId, obtained: m.obtainedMarks, max: m.maxMarks, absent: !!m.isAbsent }));
    const total = subjects.reduce((a, s) => a + (s.absent ? 0 : s.obtained), 0);
    const max = subjects.reduce((a, s) => a + s.max, 0);
    const pct = max ? (total / max) * 100 : 0;
    const g = gradeFor(pct, db.gradeScales);
    return { student, subjects, total, max, pct: Math.round(pct * 100) / 100, grade: g.grade, gpa: g.gpa, passed: g.passed && subjects.length > 0, rank: 0 };
  });
  const ranked = [...rows].filter((r) => r.subjects.length).sort((a, b) => b.pct - a.pct);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));
}

export function gradeDistribution(db: DB, examId: string): { grade: string; count: number }[] {
  const map = new Map<string, number>();
  examResults(db, examId).forEach((r) => {
    if (r.subjects.length) map.set(r.grade, (map.get(r.grade) ?? 0) + 1);
  });
  return [...map.entries()].map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade));
}

export function subjectAverages(db: DB, examId: string, classId?: string): { subject: string; avg: number }[] {
  const marks = db.marks.filter((m) => m.examId === examId && !m.isAbsent);
  const bySub = new Map<string, { sum: number; max: number; n: number }>();
  marks.forEach((m) => {
    const st = db.students.find((s) => s.id === m.studentId);
    if (classId && st?.classId !== classId) return;
    const e = bySub.get(m.subjectId) ?? { sum: 0, max: 0, n: 0 };
    e.sum += m.obtainedMarks;
    e.max += m.maxMarks;
    e.n++;
    bySub.set(m.subjectId, e);
  });
  return [...bySub.entries()].map(([id, e]) => ({
    subject: subjectName(db, id),
    avg: e.max ? Math.round((e.sum / e.max) * 1000) / 10 : 0,
  }));
}

export function detectTimetableConflicts(db: DB, candidate: Omit<TimetableSlot, 'id'> & { id?: string }): string[] {
  const issues: string[] = [];
  const overlap = (aS: string, aE: string, bS: string, bE: string): boolean => aS < bE && bS < aE;
  db.timetable.forEach((slot) => {
    if (candidate.id && slot.id === candidate.id) return;
    if (slot.day !== candidate.day) return;
    if (!overlap(slot.startTime, slot.endTime, candidate.startTime, candidate.endTime)) return;
    if (slot.teacherId === candidate.teacherId) {
      issues.push(`Teacher is already teaching ${classLabel(db, slot.classId, slot.sectionId)} (${slot.startTime}–${slot.endTime}).`);
    }
    if (candidate.room && slot.room && slot.room === candidate.room) {
      issues.push(`Room ${candidate.room} is already booked by ${classLabel(db, slot.classId, slot.sectionId)} (${slot.startTime}–${slot.endTime}).`);
    }
    if (slot.classId === candidate.classId && (slot.sectionId ?? '') === (candidate.sectionId ?? '')) {
      issues.push(`This class already has ${subjectName(db, slot.subjectId)} at ${slot.startTime}–${slot.endTime}.`);
    }
  });
  return [...new Set(issues)];
}

/* -------------------------------- dashboard --------------------------------- */

export function populationByClass(db: DB): { name: string; students: number }[] {
  return [...db.classes]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ name: c.name.replace('Grade ', 'G'), students: studentsOfClass(db, c.id).length }));
}

export function populationByGender(db: DB): { name: string; value: number }[] {
  const active = db.students.filter((s) => s.status === 'active' && !s.archived);
  return [
    { name: 'Female', value: active.filter((s) => s.gender === 'female').length },
    { name: 'Male', value: active.filter((s) => s.gender === 'male').length },
    { name: 'Other', value: active.filter((s) => s.gender === 'other').length },
  ].filter((x) => x.value > 0);
}

export function dashboard(db: DB): {
  totals: { students: number; teachers: number; staff: number; classes: number; sections: number; books: number };
  attendance: AttendanceStats;
  staffAttendance: AttendanceStats;
  financeToday: FinanceSummary;
  financeMonth: FinanceSummary;
  financeAll: FinanceSummary;
  upcomingExams: typeof db.exams;
  upcomingEvents: typeof db.events;
  recentAnnouncements: typeof db.announcements;
  recentAdmissions: Student[];
  recentPayments: typeof db.payments;
  lowAttendance: { student: Student; pct: number }[];
  overdueCount: number;
  pendingLeaves: number;
  booksOut: number;
  assignmentsDue: number;
} {
  const t = todayISO();
  const monthStart = t.slice(0, 7) + '-01';
  return {
    totals: {
      students: db.students.filter((s) => s.status === 'active' && !s.archived).length,
      teachers: db.teachers.filter((x) => x.status === 'active').length,
      staff: db.staff.filter((x) => x.status === 'active').length,
      classes: db.classes.length,
      sections: db.sections.length,
      books: db.books.reduce((a, b) => a + b.quantity, 0),
    },
    attendance: dayAttendance(db, t),
    staffAttendance: staffDayAttendance(db, t),
    financeToday: financeSummary(db, t, t),
    financeMonth: financeSummary(db, monthStart, t),
    financeAll: financeSummary(db),
    upcomingExams: db.exams.filter((e) => e.endDate >= t && e.status !== 'cancelled').sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5),
    upcomingEvents: db.events.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5),
    recentAnnouncements: [...db.announcements].sort((a, b) => b.publishDate.localeCompare(a.publishDate)).slice(0, 5),
    recentAdmissions: [...db.students].sort((a, b) => b.admissionDate.localeCompare(a.admissionDate)).slice(0, 5),
    recentPayments: [...db.payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)).slice(0, 6),
    lowAttendance: lowAttendanceStudents(db).slice(0, 5),
    overdueCount: overdueInvoices(db).length,
    pendingLeaves: db.leaves.filter((l) => l.status === 'pending').length,
    booksOut: db.libraryTxns.filter((x) => x.status === 'issued' || x.status === 'overdue').length,
    assignmentsDue: db.assignments.filter((a) => a.status === 'assigned' && a.dueDate >= t && a.dueDate <= addDaysISO(t, 7)).length,
  };
}
