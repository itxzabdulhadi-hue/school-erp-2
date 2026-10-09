import { useMemo, useState } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import type { DB } from '../../lib/db/store';
import {
  borrowerName, classLabel, employeeName, examResults, invoiceBalance, staffName,
  studentAttendanceStats, studentName, studentsOfClass, subjectAverages, teacherName,
} from '../../lib/db/selectors';
import { useFmt, useMoney, useSchool } from '../../lib/useSchool';
import { addDaysISO, exportCSV, todayISO } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { Card, PageHeader } from '../../components/ui/primitives';
import { toast } from '../../components/ui/toast';

type FilterKey = 'class' | 'section' | 'exam' | 'date' | 'from' | 'to' | 'month' | 'status';

interface Filters {
  classId: string; sectionId: string; examId: string;
  date: string; from: string; to: string; month: string; status: string;
}

interface Ctx {
  fmt: ReturnType<typeof useFmt>;
  money: (n: number) => string;
}

interface ReportDef {
  id: string;
  category: string;
  title: string;
  desc: string;
  filters: FilterKey[];
  run: (db: DB, f: Filters, ctx: Ctx) => { columns: string[]; rows: (string | number)[][]; summary?: string };
}

const REPORTS: ReportDef[] = [
  {
    id: 'student-list', category: 'Students', title: 'Student list', desc: 'Complete enrollment register with status.',
    filters: ['class', 'section', 'status'],
    run: (db, f) => ({
      columns: ['Student ID', 'Admission No', 'Name', 'Gender', 'Class', 'Roll', 'Phone', 'Status'],
      rows: db.students
        .filter((s) => !s.archived && (!f.classId || s.classId === f.classId) && (!f.sectionId || s.sectionId === f.sectionId) && (!f.status || s.status === f.status))
        .map((s) => [s.studentId, s.admissionNo, studentName(s), s.gender, classLabel(db, s.classId, s.sectionId), s.rollNo ?? '', s.phone ?? '', s.status]),
    }),
  },
  {
    id: 'class-strength', category: 'Students', title: 'Class-wise strength', desc: 'Enrollment per class with gender split.',
    filters: [],
    run: (db) => ({
      columns: ['Class', 'Sections', 'Girls', 'Boys', 'Total'],
      rows: [...db.classes].sort((a, b) => a.order - b.order).map((c) => {
        const p = studentsOfClass(db, c.id);
        return [c.name, db.sections.filter((s) => s.classId === c.id).length, p.filter((x) => x.gender === 'female').length, p.filter((x) => x.gender === 'male').length, p.length];
      }),
    }),
  },
  {
    id: 'gender-distribution', category: 'Students', title: 'Gender distribution', desc: 'Active students by gender.',
    filters: [],
    run: (db) => {
      const a = db.students.filter((s) => s.status === 'active' && !s.archived);
      return {
        columns: ['Gender', 'Count', '%'],
        rows: ['female', 'male', 'other'].map((g) => {
          const n = a.filter((x) => x.gender === g).length;
          return [g, n, a.length ? Math.round((n / a.length) * 1000) / 10 : 0];
        }),
      };
    },
  },
  {
    id: 'new-admissions', category: 'Students', title: 'New admissions', desc: 'Students admitted within a period.',
    filters: ['from', 'to'],
    run: (db, f, { fmt }) => ({
      columns: ['Student ID', 'Name', 'Class', 'Admission date', 'Previous school'],
      rows: db.students.filter((s) => (!f.from || s.admissionDate >= f.from) && (!f.to || s.admissionDate <= f.to))
        .sort((a, b) => b.admissionDate.localeCompare(a.admissionDate))
        .map((s) => [s.studentId, studentName(s), classLabel(db, s.classId, s.sectionId), fmt.date(s.admissionDate), s.previousSchool ?? '—']),
    }),
  },
  {
    id: 'withdrawals', category: 'Students', title: 'Withdrawals & transfers', desc: 'Inactive, graduated, transferred and withdrawn students.',
    filters: [],
    run: (db) => ({
      columns: ['Student ID', 'Name', 'Class', 'Status'],
      rows: db.students.filter((s) => s.status !== 'active').map((s) => [s.studentId, studentName(s), classLabel(db, s.classId, s.sectionId), s.status]),
    }),
  },
  {
    id: 'daily-register', category: 'Attendance', title: 'Daily register', desc: 'Who was present, absent, late or excused on a day.',
    filters: ['date', 'class', 'section'],
    run: (db, f) => {
      const pupils = studentsOfClass(db, f.classId || undefined, f.sectionId || undefined);
      const map = new Map(db.attendance.filter((a) => a.date === f.date && a.personType === 'student').map((a) => [a.studentId, a.status]));
      return {
        columns: ['Student', 'Class', 'Status'],
        rows: pupils.map((s) => [studentName(s), classLabel(db, s.classId, s.sectionId), map.get(s.id) ?? 'not marked']),
      };
    },
  },
  {
    id: 'monthly-attendance', category: 'Attendance', title: 'Monthly attendance', desc: 'Per-student monthly breakdown with rates.',
    filters: ['month', 'class'],
    run: (db, f) => ({
      columns: ['Student', 'Class', 'Present', 'Absent', 'Late', 'Excused', 'Rate %'],
      rows: studentsOfClass(db, f.classId || undefined).map((s) => {
        const st = studentAttendanceStats(db, s.id, `${f.month}-01`, `${f.month}-31`);
        return [studentName(s), classLabel(db, s.classId, s.sectionId), st.present, st.absent, st.late, st.excused, st.pct];
      }),
    }),
  },
  {
    id: 'absence-list', category: 'Attendance', title: 'Absence report', desc: 'Every absence in a period for follow-up.',
    filters: ['from', 'to'],
    run: (db, f, { fmt }) => ({
      columns: ['Date', 'Student', 'Class', 'Status'],
      rows: db.attendance.filter((a) => a.personType === 'student' && a.status === 'absent' && (!f.from || a.date >= f.from) && (!f.to || a.date <= f.to))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((a) => {
          const s = db.students.find((x) => x.id === a.studentId);
          return [fmt.date(a.date), s ? studentName(s) : '—', s ? classLabel(db, s.classId, s.sectionId) : '—', 'absent'];
        }),
    }),
  },
  {
    id: 'staff-attendance', category: 'Attendance', title: 'Staff attendance', desc: 'Employee register for a day.',
    filters: ['date'],
    run: (db, f) => {
      const map = new Map(db.attendance.filter((a) => a.date === f.date && a.personType === 'employee').map((a) => [a.employeeId, a.status]));
      return {
        columns: ['Employee', 'Role', 'Status'],
        rows: [
          ...db.teachers.map((t) => [teacherName(t), 'Teacher', map.get(t.id) ?? 'not marked']),
          ...db.staff.map((t) => [staffName(t), t.designation ?? 'Staff', map.get(t.id) ?? 'not marked']),
        ],
      };
    },
  },
  {
    id: 'exam-results', category: 'Academics', title: 'Exam results', desc: 'Ranked result sheet with grades.',
    filters: ['exam', 'class'],
    run: (db, f) => ({
      columns: ['Rank', 'Student', 'Class', 'Total', 'Max', '%', 'Grade', 'Result'],
      rows: examResults(db, f.examId, f.classId || undefined).filter((r) => r.subjects.length)
        .map((r) => [r.rank, studentName(r.student), classLabel(db, r.student.classId, r.student.sectionId), r.total, r.max, r.pct, r.grade, r.passed ? 'Pass' : 'Fail']),
    }),
  },
  {
    id: 'class-performance', category: 'Academics', title: 'Class performance', desc: 'Average and pass rate per class.',
    filters: ['exam'],
    run: (db, f) => ({
      columns: ['Class', 'Graded', 'Average %', 'Passed', 'Pass rate %'],
      rows: [...db.classes].sort((a, b) => a.order - b.order).map((c) => {
        const rows = examResults(db, f.examId, c.id).filter((r) => r.subjects.length);
        const avg = rows.length ? Math.round((rows.reduce((a, r) => a + r.pct, 0) / rows.length) * 10) / 10 : 0;
        const passed = rows.filter((r) => r.passed).length;
        return [c.name, rows.length, avg, passed, rows.length ? Math.round((passed / rows.length) * 1000) / 10 : 0];
      }),
    }),
  },
  {
    id: 'subject-performance', category: 'Academics', title: 'Subject performance', desc: 'Average score per subject.',
    filters: ['exam', 'class'],
    run: (db, f) => ({
      columns: ['Subject', 'Average %'],
      rows: subjectAverages(db, f.examId, f.classId || undefined).map((s) => [s.subject, s.avg]),
    }),
  },
  {
    id: 'pass-fail', category: 'Academics', title: 'Pass / fail statistics', desc: 'Outcome counts for an exam.',
    filters: ['exam'],
    run: (db, f) => {
      const rows = examResults(db, f.examId).filter((r) => r.subjects.length);
      const passed = rows.filter((r) => r.passed).length;
      return {
        columns: ['Outcome', 'Count', '%'],
        rows: [
          ['Pass', passed, rows.length ? Math.round((passed / rows.length) * 1000) / 10 : 0],
          ['Fail', rows.length - passed, rows.length ? Math.round(((rows.length - passed) / rows.length) * 1000) / 10 : 0],
        ],
        summary: `${rows.length} students graded`,
      };
    },
  },
  {
    id: 'fee-collection', category: 'Finance', title: 'Fee collection', desc: 'Receipts within a period.',
    filters: ['from', 'to'],
    run: (db, f, { fmt, money }) => {
      const rows = db.payments.filter((p) => (!f.from || p.paymentDate >= f.from) && (!f.to || p.paymentDate <= f.to))
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      return {
        columns: ['Date', 'Receipt', 'Student', 'Invoice', 'Method', 'Amount'],
        rows: rows.map((p) => [fmt.date(p.paymentDate), p.receiptNo, borrowerName(db, 'student', p.studentId), db.invoices.find((i) => i.id === p.invoiceId)?.invoiceNo ?? '', p.method, money(p.amount)]),
        summary: `Total collected: ${money(rows.reduce((a, p) => a + p.amount, 0))} across ${rows.length} receipts`,
      };
    },
  },
  {
    id: 'outstanding', category: 'Finance', title: 'Outstanding fees', desc: 'All unpaid and partial balances.',
    filters: ['class'],
    run: (db, f, { fmt, money }) => {
      const rows = db.invoices.filter((i) => (i.status === 'unpaid' || i.status === 'partial' || i.status === 'overdue') && (!f.classId || db.students.find((s) => s.id === i.studentId)?.classId === f.classId));
      return {
        columns: ['Invoice', 'Student', 'Class', 'Due date', 'Total', 'Paid', 'Balance', 'Status'],
        rows: rows.map((i) => {
          const s = db.students.find((x) => x.id === i.studentId);
          return [i.invoiceNo, s ? studentName(s) : '', s ? classLabel(db, s.classId, s.sectionId) : '', fmt.date(i.dueDate), money(i.total), money(i.paid), money(invoiceBalance(i)), i.status];
        }),
        summary: `Outstanding: ${money(rows.reduce((a, i) => a + invoiceBalance(i), 0))}`,
      };
    },
  },
  {
    id: 'overdue-fees', category: 'Finance', title: 'Overdue fees', desc: 'Past-due invoices requiring follow-up.',
    filters: [],
    run: (db, _f, { fmt, money }) => {
      const rows = db.invoices.filter((i) => i.status === 'overdue').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return {
        columns: ['Invoice', 'Student', 'Phone', 'Due date', 'Balance'],
        rows: rows.map((i) => {
          const s = db.students.find((x) => x.id === i.studentId);
          return [i.invoiceNo, s ? studentName(s) : '', s?.phone ?? '', fmt.date(i.dueDate), money(invoiceBalance(i))];
        }),
        summary: `${rows.length} overdue · ${money(rows.reduce((a, i) => a + invoiceBalance(i), 0))}`,
      };
    },
  },
  {
    id: 'discounts-fines', category: 'Finance', title: 'Discounts & fines', desc: 'Concessions granted and fines levied.',
    filters: [],
    run: (db, _f, { money }) => ({
      columns: ['Invoice', 'Student', 'Discount', 'Fine'],
      rows: db.invoices.filter((i) => i.discount > 0 || i.fine > 0)
        .map((i) => [i.invoiceNo, borrowerName(db, 'student', i.studentId), money(i.discount), money(i.fine)]),
      summary: `Discounts ${money(db.invoices.reduce((a, i) => a + i.discount, 0))} · Fines ${money(db.invoices.reduce((a, i) => a + i.fine, 0))}`,
    }),
  },
  {
    id: 'people-directory', category: 'Staff', title: 'People directory', desc: 'Teachers and staff with status.',
    filters: ['status'],
    run: (db, f, { fmt }) => ({
      columns: ['ID', 'Name', 'Role', 'Department', 'Phone', 'Joined', 'Status'],
      rows: [
        ...db.teachers.filter((t) => !f.status || t.status === f.status).map((t) => [t.employeeId, teacherName(t), t.designation ?? 'Teacher', db.departments.find((d) => d.id === t.departmentId)?.name ?? '', t.phone, fmt.date(t.joiningDate), t.status]),
        ...db.staff.filter((t) => !f.status || t.status === f.status).map((t) => [t.employeeId, staffName(t), t.designation ?? 'Staff', db.departments.find((d) => d.id === t.departmentId)?.name ?? '', t.phone, fmt.date(t.joiningDate), t.status]),
      ],
    }),
  },
  {
    id: 'leave-register', category: 'Staff', title: 'Leave register', desc: 'All leave requests with decisions.',
    filters: ['status'],
    run: (db, f, { fmt }) => ({
      columns: ['Applicant', 'Type', 'Leave', 'From', 'To', 'Status'],
      rows: db.leaves.filter((l) => !f.status || l.status === f.status).map((l) => [
        l.personType === 'student' ? studentName(db.students.find((s) => s.id === l.studentId)) : employeeName(db, l.personType, l.employeeId),
        l.personType, l.leaveType, fmt.date(l.startDate), fmt.date(l.endDate), l.status,
      ]),
    }),
  },
  {
    id: 'library-circulation', category: 'Library', title: 'Circulation report', desc: 'Issues, returns and fines.',
    filters: ['status'],
    run: (db, f, { fmt, money }) => ({
      columns: ['Book', 'Borrower', 'Issued', 'Due', 'Returned', 'Fine', 'Status'],
      rows: db.libraryTxns.filter((t) => !f.status || t.status === f.status).map((t) => [
        db.books.find((b) => b.id === t.bookId)?.title ?? '', borrowerName(db, t.borrowerType, t.borrowerId),
        fmt.date(t.issueDate), fmt.date(t.dueDate), t.returnDate ? fmt.date(t.returnDate) : '', money(t.fine), t.status,
      ]),
    }),
  },
  {
    id: 'library-overdue', category: 'Library', title: 'Overdue books', desc: 'Books past their due date.',
    filters: [],
    run: (db, _f, { fmt, money }) => ({
      columns: ['Book', 'Borrower', 'Due date', 'Days overdue', 'Fine'],
      rows: db.libraryTxns.filter((t) => t.status === 'overdue').map((t) => [
        db.books.find((b) => b.id === t.bookId)?.title ?? '', borrowerName(db, t.borrowerType, t.borrowerId), fmt.date(t.dueDate),
        Math.max(0, Math.round((Date.now() - new Date(`${t.dueDate}T12:00:00`).getTime()) / 86400000)), money(t.fine),
      ]),
    }),
  },
];

const CATEGORIES = [...new Set(REPORTS.map((r) => r.category))];

export function ReportsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const fmt = useFmt();
  const money = useMoney();
  const t = todayISO();
  const [activeId, setActiveId] = useState('student-list');
  const [f, setF] = useState<Filters>({
    classId: '', sectionId: '', examId: snap.exams[0]?.id ?? '',
    date: t, from: addDaysISO(t, -30), to: t, month: t.slice(0, 7), status: '',
  });

  const report = REPORTS.find((r) => r.id === activeId) ?? REPORTS[0];
  const result = useMemo(() => report.run(snap, f, { fmt, money }), [snap, f, report, fmt, money]);

  const set = (p: Partial<Filters>): void => setF((x) => ({ ...x, ...p }));

  return (
    <div>
      <PageHeader title="Reports" subtitle="Filter, print and export every corner of the school" actions={<></>} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="no-print h-fit lg:sticky lg:top-20">
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="mb-2">
                <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{cat}</p>
                {REPORTS.filter((r) => r.category === cat).map((r) => (
                  <button
                    key={r.id} type="button" onClick={() => setActiveId(r.id)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm', activeId === r.id ? 'bg-[var(--brand-primary-light)] font-semibold text-[var(--brand-primary-dark)]' : 'text-slate-600 hover:bg-slate-100')}
                  >
                    <BarChart3 className="h-4 w-4 shrink-0 opacity-60" />{r.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-bold">{report.title}</h2>
            <p className="text-xs text-slate-500">{report.desc}</p>
            <div className="no-print mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {report.filters.includes('class') ? (
                <select value={f.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })} className="input">
                  <option value="">All classes</option>{snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : null}
              {report.filters.includes('section') ? (
                <select value={f.sectionId} onChange={(e) => set({ sectionId: e.target.value })} className="input">
                  <option value="">All sections</option>{snap.sections.filter((s) => !f.classId || s.classId === f.classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : null}
              {report.filters.includes('exam') ? (
                <select value={f.examId} onChange={(e) => set({ examId: e.target.value })} className="input">
                  {snap.exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              ) : null}
              {report.filters.includes('date') ? <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className="input" /> : null}
              {report.filters.includes('month') ? <input type="month" value={f.month} onChange={(e) => set({ month: e.target.value })} className="input" /> : null}
              {report.filters.includes('from') ? <input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} className="input" aria-label="From" /> : null}
              {report.filters.includes('to') ? <input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} className="input" aria-label="To" /> : null}
              {report.filters.includes('status') ? (
                <select value={f.status} onChange={(e) => set({ status: e.target.value })} className="input">
                  <option value="">All statuses</option>
                  {['active', 'inactive', 'graduated', 'transferred', 'withdrawn', 'pending', 'approved', 'rejected', 'issued', 'returned', 'overdue', 'lost', 'on-leave', 'resigned', 'retired', 'terminated'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : null}
            </div>
          </div>

          {/* Print-only letterhead */}
          <div className="print-only px-5 pt-4">
            <h1 className="text-xl font-extrabold">{school.name}</h1>
            <p className="text-sm">{report.title} · Generated {fmt.date(t)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
            <p className="text-xs text-slate-500">{result.rows.length} rows{result.summary ? ` · ${result.summary}` : ''}</p>
            <div className="no-print ml-auto flex gap-2">
              <button
                type="button" className="btn-secondary !py-1.5 text-xs"
                onClick={() => { exportCSV(report.id, result.columns, result.rows); toast.success('Report exported to CSV'); }}
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
              <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0"><tr className="table-head">{result.columns.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2.5 text-left">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">{row.map((cell, j) => <td key={j} className="table-cell">{cell}</td>)}</tr>
                ))}
                {result.rows.length === 0 ? <tr><td colSpan={result.columns.length} className="px-4 py-10 text-center text-sm text-slate-400">No data for these filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
