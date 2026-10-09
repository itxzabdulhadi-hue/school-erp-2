import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { DocLetterhead, DocSignatures } from '../../components/branding/BrandingProvider';
import { useDB } from '../../lib/db/store';
import {
  classLabel, examResults, studentAttendanceStats, studentName, teacherName,
} from '../../lib/db/selectors';
import { gradeFor } from '../../lib/grading';
import { useFmt, useMoney, useSchool } from '../../lib/useSchool';
import { calcAge } from '../../lib/utils';

/* --------------------------------- shell ----------------------------------- */

function Shell(props: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="min-h-screen bg-slate-200 p-3 sm:p-8">
      <div className="no-print mx-auto mb-3 flex max-w-4xl items-center justify-between">
        <Link to="/" className="btn-secondary !bg-white"><ArrowLeft className="h-4 w-4" /> Back to ERP</Link>
        <button type="button" onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" /> Print / Save PDF</button>
      </div>
      <div className="doc-paper print-full mx-auto max-w-4xl rounded-xl p-6 shadow-card sm:p-10">
        <p className="sr-only">{props.title}</p>
        {props.children}
      </div>
    </div>
  );
}

function NotFound(props: { what: string }): React.JSX.Element {
  return (
    <Shell title="Not found">
      <p className="py-16 text-center text-slate-500">{props.what} not found. <Link to="/" className="link">Go back</Link></p>
    </Shell>
  );
}

/* ------------------------------ amount in words ----------------------------- */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function words(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${words(n % 100)}` : ''}`;
  if (n < 1000000) return `${words(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${words(n % 1000)}` : ''}`;
  return `${words(Math.floor(n / 1000000))} Million${n % 1000000 ? ` ${words(n % 1000000)}` : ''}`;
}

function amountInWords(amount: number, currency: string): string {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  let s = `${words(whole) || 'Zero'} ${currency}`;
  if (cents) s += ` and ${words(cents)} Cents`;
  return `${s} Only`;
}

/* --------------------------------- student ---------------------------------- */

export function StudentPrint(): React.JSX.Element {
  const snap = useDB((s) => s);
  const fmt = useFmt();
  const money = useMoney();
  const { id } = useParams();
  const student = snap.students.find((s) => s.id === id);
  if (!student) return <NotFound what="Student" />;
  const guardians = snap.guardians.filter((g) => g.studentId === student.id);
  const stats = studentAttendanceStats(snap, student.id);
  const invoices = snap.invoices.filter((i) => i.studentId === student.id && i.status !== 'cancelled');
  const outstanding = invoices.reduce((a, i) => a + Math.max(0, i.total - i.paid), 0);
  const age = calcAge(student.dob);

  const rows: [string, string][] = [
    ['Student ID', student.studentId], ['Admission No', student.admissionNo],
    ['Name', studentName(student)], ['Class', classLabel(snap, student.classId, student.sectionId)],
    ['Roll No', student.rollNo ?? '—'], ['Gender', student.gender],
    ['Date of Birth', `${fmt.date(student.dob)}${age !== null ? ` (${age} yrs)` : ''}`],
    ['Blood Group', student.bloodGroup ?? '—'], ['Nationality', student.nationality ?? '—'],
    ['Phone', student.phone ?? '—'], ['Email', student.email ?? '—'],
    ['Address', [student.address, student.city].filter(Boolean).join(', ') || '—'],
    ['Admission Date', fmt.date(student.admissionDate)], ['Status', student.status],
    ['Attendance Rate', `${stats.pct}% (${stats.present} present / ${stats.total})`],
    ['Fee Outstanding', money(outstanding)],
  ];

  return (
    <Shell title="Student profile">
      <DocLetterhead subtitle="Student Profile" right={<div className="text-xs text-slate-500">Printed<br />{fmt.date(new Date().toISOString().slice(0, 10))}</div>} />
      <table className="mt-6 w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-100">
              <td className="w-44 py-2 pr-4 font-semibold text-slate-500">{k}</td>
              <td className="py-2 text-slate-800">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">Guardians</h3>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400"><th className="py-2">Name</th><th>Relationship</th><th>Phone</th><th>Email</th></tr></thead>
        <tbody>
          {guardians.map((g) => (
            <tr key={g.id} className="border-b border-slate-100"><td className="py-2 font-medium">{g.name}{g.isPrimary ? ' (Primary)' : ''}</td><td>{g.relationship}</td><td>{g.phone}</td><td>{g.email ?? '—'}</td></tr>
          ))}
          {guardians.length === 0 ? <tr><td colSpan={4} className="py-3 text-slate-400">No guardians on record.</td></tr> : null}
        </tbody>
      </table>
      <DocSignatures left="Registrar" />
    </Shell>
  );
}

/* --------------------------------- invoice ---------------------------------- */

export function InvoicePrint(): React.JSX.Element {
  const snap = useDB((s) => s);
  const fmt = useFmt();
  const money = useMoney();
  const { id } = useParams();
  const inv = snap.invoices.find((i) => i.id === id);
  if (!inv) return <NotFound what="Invoice" />;
  const student = snap.students.find((s) => s.id === inv.studentId);
  const guardian = snap.guardians.find((g) => g.studentId === inv.studentId && g.isPrimary);
  const subtotal = inv.items.reduce((a, i) => a + i.amount, 0);
  const balance = Math.max(0, inv.total - inv.paid);

  return (
    <Shell title={`Invoice ${inv.invoiceNo}`}>
      <DocLetterhead
        subtitle="Fee Invoice"
        right={
          <div className="text-sm">
            <p className="text-lg font-extrabold">{inv.invoiceNo}</p>
            <p className="text-xs text-slate-500">Issue: {fmt.date(inv.issueDate)}</p>
            <p className="text-xs text-slate-500">Due: {fmt.date(inv.dueDate)}</p>
            <p className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase">{inv.status}</p>
          </div>
        }
      />
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-bold uppercase text-slate-400">Bill to</p>
          <p className="font-bold">{student ? studentName(student) : '—'}</p>
          <p className="text-slate-600">{student ? classLabel(snap, student.classId, student.sectionId) : ''} {student?.studentId ? `· ${student.studentId}` : ''}</p>
          {guardian ? <p className="text-slate-600">Guardian: {guardian.name} · {guardian.phone}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase text-slate-400">Term</p>
          <p className="font-semibold">{inv.term ?? '—'}</p>
        </div>
      </div>
      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b-2 border-slate-200 text-left text-xs uppercase text-slate-400"><th className="py-2">#</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={it.id} className="border-b border-slate-100"><td className="py-2">{i + 1}</td><td>{it.label}</td><td className="py-2 text-right">{money(it.amount)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end">
        <table className="w-64 text-sm">
          <tbody>
            <tr><td className="py-1 text-slate-500">Subtotal</td><td className="py-1 text-right">{money(subtotal)}</td></tr>
            <tr><td className="py-1 text-slate-500">Discount</td><td className="py-1 text-right">− {money(inv.discount)}</td></tr>
            <tr><td className="py-1 text-slate-500">Fine</td><td className="py-1 text-right">+ {money(inv.fine)}</td></tr>
            <tr className="border-t border-slate-200 font-extrabold"><td className="py-1">Total</td><td className="py-1 text-right">{money(inv.total)}</td></tr>
            <tr><td className="py-1 text-slate-500">Paid</td><td className="py-1 text-right text-emerald-700">{money(inv.paid)}</td></tr>
            <tr className="font-extrabold"><td className="py-1">Balance due</td><td className="py-1 text-right">{money(balance)}</td></tr>
          </tbody>
        </table>
      </div>
      {inv.notes ? <p className="mt-4 text-xs text-slate-500">Notes: {inv.notes}</p> : null}
      <p className="mt-6 text-center text-xs text-slate-400">Please pay by the due date to avoid late fines. Thank you.</p>
      <DocSignatures left="Received by" right="Accounts Office" />
    </Shell>
  );
}

/* --------------------------------- receipt ---------------------------------- */

export function ReceiptPrint(): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const fmt = useFmt();
  const money = useMoney();
  const { id } = useParams();
  const pay = snap.payments.find((p) => p.id === id);
  if (!pay) return <NotFound what="Receipt" />;
  const inv = snap.invoices.find((i) => i.id === pay.invoiceId);
  const student = snap.students.find((s) => s.id === pay.studentId);
  const balance = inv ? Math.max(0, inv.total - inv.paid) : 0;

  return (
    <Shell title={`Receipt ${pay.receiptNo}`}>
      <DocLetterhead
        subtitle="Payment Receipt"
        right={
          <div className="text-sm">
            <p className="text-lg font-extrabold">{pay.receiptNo}</p>
            <p className="text-xs text-slate-500">Date: {fmt.date(pay.paymentDate)}</p>
          </div>
        }
      />
      <div className="mt-6 rounded-lg border border-slate-200 p-5 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <p><span className="text-slate-500">Received from:</span><br /><span className="font-bold">{student ? studentName(student) : '—'}</span></p>
          <p><span className="text-slate-500">Class:</span><br /><span className="font-semibold">{student ? classLabel(snap, student.classId, student.sectionId) : '—'}</span></p>
          <p><span className="text-slate-500">Against invoice:</span><br /><span className="font-semibold">{inv?.invoiceNo ?? '—'}</span></p>
          <p><span className="text-slate-500">Method:</span><br /><span className="font-semibold capitalize">{pay.method}</span>{pay.reference ? ` · ${pay.reference}` : ''}</p>
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400">Amount received</p>
          <p className="text-3xl font-extrabold">{money(pay.amount)}</p>
          <p className="mt-1 text-xs italic text-slate-500">{amountInWords(pay.amount, school.currency)}</p>
        </div>
        <p className="mt-3 text-right text-sm">Remaining balance on invoice: <span className="font-bold">{money(balance)}</span></p>
        {pay.notes ? <p className="mt-2 text-xs text-slate-500">Notes: {pay.notes}</p> : null}
      </div>
      <DocSignatures left="Received by" right="Accounts Office" />
    </Shell>
  );
}

/* -------------------------------- report card -------------------------------- */

export function ReportCardPrint(): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const { studentId, examId } = useParams();
  const student = snap.students.find((s) => s.id === studentId);
  const exam = snap.exams.find((e) => e.id === examId);
  if (!student || !exam) return <NotFound what="Report card" />;
  const rows = examResults(snap, exam.id);
  const row = rows.find((r) => r.student.id === student.id);
  const stats = studentAttendanceStats(snap, student.id);
  const classStrength = rows.filter((r) => r.subjects.length).length;

  return (
    <Shell title="Report card">
      <DocLetterhead
        subtitle="Student Report Card"
        right={<div className="text-xs text-slate-500">{exam.name}<br />{exam.term} · {school.academicYear}</div>}
      />
      <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <p><span className="text-slate-500">Name:</span><br /><span className="font-bold">{studentName(student)}</span></p>
        <p><span className="text-slate-500">Class:</span><br /><span className="font-semibold">{classLabel(snap, student.classId, student.sectionId)}</span></p>
        <p><span className="text-slate-500">Student ID / Roll:</span><br /><span className="font-semibold">{student.studentId} / {student.rollNo ?? '—'}</span></p>
      </div>
      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b-2 border-slate-200 text-left text-xs uppercase text-slate-400"><th className="py-2">Subject</th><th className="text-right">Max</th><th className="text-right">Obtained</th><th className="text-right">%</th><th>Grade</th></tr></thead>
        <tbody>
          {row?.subjects.map((s) => {
            const g = gradeFor(s.absent ? 0 : (s.obtained / s.max) * 100, snap.gradeScales);
            const pct = s.absent ? '—' : `${Math.round((s.obtained / s.max) * 1000) / 10}%`;
            return (
              <tr key={s.subjectId} className="border-b border-slate-100">
                <td className="py-2 font-medium">{snap.subjects.find((x) => x.id === s.subjectId)?.name}</td>
                <td className="py-2 text-right">{s.max}</td>
                <td className="py-2 text-right">{s.absent ? 'AB' : s.obtained}</td>
                <td className="py-2 text-right">{pct}</td>
                <td className="py-2 font-bold">{s.absent ? 'AB' : g.grade}</td>
              </tr>
            );
          }) ?? null}
          {row ? (
            <tr className="bg-slate-50 font-extrabold">
              <td className="py-2">Total</td><td className="py-2 text-right">{row.max}</td>
              <td className="py-2 text-right">{row.total}</td><td className="py-2 text-right">{row.pct}%</td>
              <td className="py-2">{row.grade}{school.gpaEnabled && row.gpa !== null ? ` (${row.gpa})` : ''}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {!row || !row.subjects.length ? <p className="mt-4 text-sm text-slate-400">No marks entered for this exam yet.</p> : (
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Result</p><p className={`text-lg font-extrabold ${row.passed ? 'text-emerald-700' : 'text-red-600'}`}>{row.passed ? 'PASS' : 'FAIL'}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Position</p><p className="text-lg font-extrabold">{row.rank || '—'} <span className="text-xs font-normal text-slate-400">of {classStrength}</span></p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Attendance</p><p className="text-lg font-extrabold">{stats.pct}%</p></div>
        </div>
      )}
      <div className="mt-4 space-y-2 text-sm">
        <p><span className="font-semibold">Class teacher's remarks:</span> <span className="text-slate-600">{row && row.subjects.length ? (snap.gradeScales.find((g) => g.grade === row.grade)?.remarks ?? '—') : '—'}</span></p>
        <p><span className="font-semibold">Principal's remarks:</span> <span className="text-slate-600">Keep up the good work and aim higher next term.</span></p>
      </div>
      <DocSignatures />
    </Shell>
  );
}

/* -------------------------------- certificate -------------------------------- */

const CERT_TITLES: Record<string, string> = {
  character: 'Character Certificate', bonafide: 'Bonafide Certificate', leaving: 'School Leaving Certificate',
  transfer: 'Transfer Certificate', enrollment: 'Enrollment Certificate', custom: 'Certificate',
};

function certBody(type: string, student: string, cls: string, school: string): string {
  switch (type) {
    case 'character':
      return `This is to certify that ${student} is a bonafide student of ${school}, studying in ${cls}. To the best of our knowledge, the student's conduct and character have remained good during the period of study at this institution.`;
    case 'bonafide':
      return `This is to certify that ${student} is a bonafide student of ${school}, currently enrolled in ${cls} for the ongoing academic session.`;
    case 'leaving':
      return `This is to certify that ${student}, a student of ${cls} at ${school}, is leaving the institution. All dues have been cleared and the student's record has been closed as per school policy. We wish the student every success in future endeavours.`;
    case 'transfer':
      return `This is to certify that ${student} was a student of ${cls} at ${school} and has applied for a transfer. The student's conduct remained satisfactory. This certificate is issued to facilitate admission to another institution.`;
    case 'enrollment':
      return `This is to certify that ${student} is duly enrolled at ${school} in ${cls}. This certificate is issued for official purposes as requested.`;
    default:
      return `This is to certify that ${student} of ${cls}, ${school}.`;
  }
}

export function CertificatePrint(): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const fmt = useFmt();
  const { id } = useParams();
  const cert = snap.certificates.find((c) => c.id === id);
  if (!cert) return <NotFound what="Certificate" />;
  const student = snap.students.find((s) => s.id === cert.studentId);
  const name = student ? studentName(student) : '—';
  const cls = student ? classLabel(snap, student.classId, student.sectionId) : '—';
  const body = cert.type === 'custom' && cert.customBody ? cert.customBody : certBody(cert.type, name, cls, school.name);

  return (
    <Shell title="Certificate">
      <div className="rounded-xl border-4 p-8" style={{ borderColor: school.primaryColor }}>
        <DocLetterhead subtitle={cert.type === 'custom' && cert.customTitle ? cert.customTitle : CERT_TITLES[cert.type]} />
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Certificate No: <b className="text-slate-800">{cert.certNo}</b></span>
          <span>Date of Issue: <b className="text-slate-800">{fmt.date(cert.issueDate)}</b></span>
        </div>
        <p className="mt-8 text-center text-lg font-semibold text-slate-500">This certificate is proudly presented</p>
        <p className="mt-1 text-center text-3xl font-extrabold" style={{ color: school.secondaryColor }}>{name}</p>
        <p className="mx-auto mt-6 max-w-2xl text-center leading-relaxed text-slate-700">{body}</p>
        {cert.purpose ? <p className="mt-4 text-center text-sm text-slate-500">Purpose: {cert.purpose}</p> : null}
        <DocSignatures left="Registrar" />
      </div>
    </Shell>
  );
}

/* --------------------------------- timetable --------------------------------- */

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function TimetablePrint(): React.JSX.Element {
  const snap = useDB((s) => s);
  const fmt = useFmt();
  const [params] = useSearchParams();
  const classId = params.get('class') ?? '';
  const sectionId = params.get('section') ?? '';
  const teacherId = params.get('teacher') ?? '';

  const slots = teacherId
    ? snap.timetable.filter((t) => t.teacherId === teacherId)
    : snap.timetable.filter((t) => t.classId === classId && (!sectionId || (t.sectionId ?? '') === sectionId));
  const times = [...new Map(slots.map((s) => [`${s.startTime}-${s.endTime}`, { start: s.startTime, end: s.endTime }])).values()]
    .sort((a, b) => a.start.localeCompare(b.start));
  const title = teacherId
    ? `Teacher Timetable — ${teacherName(snap.teachers.find((t) => t.id === teacherId))}`
    : `Class Timetable — ${classLabel(snap, classId, sectionId || undefined)}`;

  return (
    <Shell title={title}>
      <DocLetterhead subtitle={title} />
      <table className="mt-6 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-50 px-2 py-2 text-left">Time</th>
            {[1, 2, 3, 4, 5, 6].map((d) => <th key={d} className="border border-slate-300 bg-slate-50 px-2 py-2 text-left">{DAY_NAMES[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {times.map((t) => (
            <tr key={`${t.start}-${t.end}`}>
              <td className="border border-slate-200 px-2 py-2 font-semibold">{fmt.time(t.start)} – {fmt.time(t.end)}</td>
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const cells = slots.filter((s) => s.day === d && s.startTime === t.start && s.endTime === t.end);
                return (
                  <td key={d} className="border border-slate-200 px-2 py-2 align-top">
                    {cells.map((s) => (
                      <p key={s.id} className="mb-1">
                        <b>{snap.subjects.find((x) => x.id === s.subjectId)?.name}</b><br />
                        <span className="text-slate-500">{teacherId ? classLabel(snap, s.classId, s.sectionId) : teacherName(snap.teachers.find((x) => x.id === s.teacherId))}</span>
                        {s.room ? <span className="text-slate-400"> · {s.room}</span> : null}
                      </p>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
          {times.length === 0 ? <tr><td colSpan={7} className="border border-slate-200 px-2 py-8 text-center text-slate-400">No periods scheduled.</td></tr> : null}
        </tbody>
      </table>
      <DocSignatures left="Timetable Coordinator" />
    </Shell>
  );
}
