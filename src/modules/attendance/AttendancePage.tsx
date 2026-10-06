import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, Download } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import {
  classLabel, employeeName, lowAttendanceStudents, studentAttendanceStats,
  studentName, studentsOfClass, teacherName, staffName,
} from '../../lib/db/selectors';
import type { AttendanceStatus } from '../../lib/db/types';
import { useFmt, useSchool } from '../../lib/useSchool';
import { cn, exportCSV, todayISO } from '../../lib/utils';
import { Badge, Card, PageHeader, ProgressBar, StatusPill, Tabs } from '../../components/ui/primitives';
import { toast } from '../../components/ui/toast';

type TabId = 'students' | 'staff' | 'reports';

const STUDENT_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];
const STAFF_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'leave', 'half-day', 'excused'];

const DOT: Record<string, string> = {
  present: 'bg-emerald-500', absent: 'bg-red-500', late: 'bg-amber-500',
  excused: 'bg-cyan-500', leave: 'bg-violet-500', 'half-day': 'bg-orange-500',
};

export function AttendancePage(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('students');
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Daily marking, staff registers and absence analytics" />
      <Card>
        <div className="p-3">
          <Tabs<TabId>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'students', label: 'Student attendance' },
              { id: 'staff', label: 'Staff attendance' },
              { id: 'reports', label: 'Reports & alerts' },
            ]}
          />
        </div>
        {tab === 'students' ? <StudentMarking /> : null}
        {tab === 'staff' ? <StaffMarking /> : null}
        {tab === 'reports' ? <AttendanceReports /> : null}
      </Card>
    </div>
  );
}

/* ------------------------------- student marking ---------------------------- */

function StudentMarking(): React.JSX.Element {
  const snap = useDB((s) => s);
  const upsert = useDB((s) => s.upsertAttendance);
  const school = useSchool();
  const [date, setDate] = useState(todayISO());
  const [classId, setClassId] = useState(snap.classes[0]?.id ?? '');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [touched, setTouched] = useState(false);

  const pupils = useMemo(
    () => studentsOfClass(snap, classId || undefined, sectionId || undefined),
    [snap, classId, sectionId],
  );
  const scopeKey = `${date}|${classId}|${sectionId}|${subjectId}`;
  const existing = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    snap.attendance.forEach((a) => {
      if (a.personType !== 'student' || a.date !== date || !a.studentId) return;
      if (school.subjectWiseAttendance && subjectId && a.subjectId !== subjectId) return;
      map[a.studentId] = a.status;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.attendance, scopeKey]);

  const statusOf = (id: string): AttendanceStatus => draft[id] ?? existing[id] ?? 'present';
  const setStatus = (id: string, st: AttendanceStatus): void => {
    setDraft((d) => ({ ...d, [id]: st }));
    setTouched(true);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    pupils.forEach((p) => {
      c[statusOf(p.id)] = (c[statusOf(p.id)] ?? 0) + 1;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pupils, draft, existing]);

  const save = (): void => {
    if (!classId) {
      toast.error('Select a class first');
      return;
    }
    upsert(pupils.map((p) => ({
      date, personType: 'student', studentId: p.id, classId: p.classId,
      sectionId: p.sectionId, subjectId: school.subjectWiseAttendance ? subjectId || undefined : undefined,
      status: statusOf(p.id),
    })));
    setDraft({});
    setTouched(false);
    toast.success(`Attendance saved for ${pupils.length} students`);
  };

  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input type="date" className="input" value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); setDraft({}); setTouched(false); }} />
        <select className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); setDraft({}); setTouched(false); }}>
          {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={sectionId} onChange={(e) => { setSectionId(e.target.value); setDraft({}); setTouched(false); }}>
          <option value="">All sections</option>
          {snap.sections.filter((s) => s.classId === classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {school.subjectWiseAttendance ? (
          <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setDraft({}); setTouched(false); }}>
            <option value="">Whole day</option>
            {snap.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : <div className="hidden lg:block" />}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => { const d: Record<string, AttendanceStatus> = {}; pupils.forEach((p) => { d[p.id] = 'present'; }); setDraft(d); setTouched(true); }}>
            <CheckCheck className="h-4 w-4" /> All present
          </button>
          <button type="button" className="btn-primary flex-1" disabled={pupils.length === 0} onClick={save}>Save{touched ? ' *' : ''}</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-3 py-2 text-xs">
        <Badge tone="green">Present: {counts.present}</Badge>
        <Badge tone="red">Absent: {counts.absent}</Badge>
        <Badge tone="amber">Late: {counts.late}</Badge>
        <Badge tone="cyan">Excused: {counts.excused}</Badge>
        <span className="ml-auto self-center text-slate-500">{pupils.length} students · {classLabel(snap, classId, sectionId || undefined)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-4 py-2.5 text-left">Student</th><th className="px-4 py-2.5 text-left">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {pupils.map((p) => {
              const cur = statusOf(p.id);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-cell">
                    <Link to={`/students/${p.id}`} className="link">{studentName(p)}</Link>
                    <span className="block text-xs text-slate-400">{p.studentId}{p.rollNo ? ` · Roll ${p.rollNo}` : ''}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {STUDENT_STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatus(p.id, st)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition',
                            cur === st ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]' : 'border-slate-200 text-slate-500 hover:border-slate-300',
                          )}
                        >
                          <span className={cn('h-2 w-2 rounded-full', DOT[st])} />{st}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {pupils.length === 0 ? <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-400">No students in this scope.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- staff marking ----------------------------- */

function StaffMarking(): React.JSX.Element {
  const snap = useDB((s) => s);
  const upsert = useDB((s) => s.upsertAttendance);
  const [date, setDate] = useState(todayISO());
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});

  const people = useMemo(
    () => [
      ...snap.teachers.filter((t) => t.status === 'active').map((t) => ({ kind: 'teacher' as const, id: t.id, name: teacherName(t), meta: t.designation ?? 'Teacher' })),
      ...snap.staff.filter((t) => t.status === 'active').map((t) => ({ kind: 'staff' as const, id: t.id, name: staffName(t), meta: t.designation ?? 'Staff' })),
    ],
    [snap],
  );
  const existing = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    snap.attendance.forEach((a) => {
      if (a.personType === 'employee' && a.date === date && a.employeeId) map[a.employeeId] = a.status;
    });
    return map;
  }, [snap, date]);

  const statusOf = (id: string): AttendanceStatus => draft[id] ?? existing[id] ?? 'present';

  const save = (): void => {
    upsert(people.map((p) => ({ date, personType: 'employee', employeeKind: p.kind, employeeId: p.id, status: statusOf(p.id) })));
    setDraft({});
    toast.success(`Staff attendance saved for ${people.length} employees`);
  };

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row">
        <input type="date" className="input sm:w-56" value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); setDraft({}); }} />
        <div className="flex gap-2 sm:ml-auto">
          <button type="button" className="btn-secondary" onClick={() => { const d: Record<string, AttendanceStatus> = {}; people.forEach((p) => { d[p.id] = 'present'; }); setDraft(d); }}>
            <CheckCheck className="h-4 w-4" /> All present
          </button>
          <button type="button" className="btn-primary" onClick={save}>Save register</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-4 py-2.5 text-left">Employee</th><th className="px-4 py-2.5 text-left">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {people.map((p) => {
              const cur = statusOf(p.id);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-cell">
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs capitalize text-slate-400">{p.kind} · {p.meta}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {STAFF_STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, [p.id]: st }))}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition',
                            cur === st ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]' : 'border-slate-200 text-slate-500 hover:border-slate-300',
                          )}
                        >
                          <span className={cn('h-2 w-2 rounded-full', DOT[st])} />{st.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------- reports --------------------------------- */

function AttendanceReports(): React.JSX.Element {
  const snap = useDB((s) => s);
  const fmt = useFmt();
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  const pupils = useMemo(() => studentsOfClass(snap, classId || undefined, sectionId || undefined), [snap, classId, sectionId]);
  const rows = useMemo(
    () => pupils.map((s) => ({ s, st: studentAttendanceStats(snap, s.id, `${month}-01`, `${month}-31`) })).sort((a, b) => a.st.pct - b.st.pct),
    [snap, pupils, month],
  );
  const alerts = useMemo(() => lowAttendanceStudents(snap), [snap]);

  const monthDays = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const cells: (string | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    const count = new Date(y, m, 0).getDate();
    for (let d = 1; d <= count; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
    return cells;
  }, [month]);

  const calMap = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    if (!studentId) return map;
    snap.attendance.forEach((a) => {
      if (a.personType === 'student' && a.studentId === studentId && a.date.startsWith(month)) map[a.date] = a.status;
    });
    return map;
  }, [snap, studentId, month]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-bold text-red-800">Low-attendance alerts (below 75% · last 30 days)</h3>
        {alerts.length === 0 ? <p className="mt-1 text-sm text-red-700">No alerts — great job.</p> : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.slice(0, 9).map(({ student, pct }) => (
              <li key={student.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <span><Link to={`/students/${student.id}`} className="link">{studentName(student)}</Link><span className="block text-xs text-slate-400">{classLabel(snap, student.classId, student.sectionId)}</span></span>
                <Badge tone={pct < 60 ? 'red' : 'amber'}>{pct}%</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 grid gap-2 sm:grid-cols-4">
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }} className="input">
            <option value="">All classes</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="input">
            <option value="">All sections</option>
            {snap.sections.filter((s) => !classId || s.classId === classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button
            type="button" className="btn-secondary"
            onClick={() => {
              exportCSV(`attendance-${month}`, ['Student', 'Class', 'Present', 'Absent', 'Late', 'Excused', 'Rate %'],
                rows.map(({ s, st }) => [studentName(s), classLabel(snap, s.classId, s.sectionId), st.present, st.absent, st.late, st.excused, st.pct]));
              toast.success('Attendance report exported');
            }}
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full">
            <thead><tr className="table-head"><th className="px-4 py-2.5 text-left">Student</th><th className="px-4 py-2.5 text-left">Class</th><th className="px-4 py-2.5 text-right">P</th><th className="px-4 py-2.5 text-right">A</th><th className="px-4 py-2.5 text-right">L</th><th className="px-4 py-2.5 text-right">E</th><th className="px-4 py-2.5 text-left">Rate</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ s, st }) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="table-cell"><Link to={`/students/${s.id}`} className="link">{studentName(s)}</Link></td>
                  <td className="table-cell text-xs">{classLabel(snap, s.classId, s.sectionId)}</td>
                  <td className="table-cell text-right text-emerald-700">{st.present}</td>
                  <td className="table-cell text-right text-red-600">{st.absent}</td>
                  <td className="table-cell text-right text-amber-600">{st.late}</td>
                  <td className="table-cell text-right text-cyan-700">{st.excused}</td>
                  <td className="table-cell"><div className="flex min-w-32 items-center gap-2"><ProgressBar value={st.pct} className="w-24" tone={st.pct < 75 ? 'bg-red-500' : st.pct < 85 ? 'bg-amber-500' : 'bg-emerald-500'} /><span className="text-xs font-bold">{st.pct}%</span></div></td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">No students in scope.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="section-title">Student calendar</h3>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input mt-2">
            <option value="">Select a student…</option>
            {pupils.map((s) => <option key={s.id} value={s.id}>{studentName(s)} — {classLabel(snap, s.classId, s.sectionId)}</option>)}
          </select>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthDays.map((day, i) => (
              <div key={i} className={cn('flex aspect-square items-center justify-center rounded-lg text-xs', day ? 'bg-slate-50' : '')}>
                {day ? (
                  <span className="flex flex-col items-center gap-0.5">
                    {Number(day.slice(8))}
                    {calMap[day] ? <span className={cn('h-1.5 w-1.5 rounded-full', DOT[calMap[day]])} title={calMap[day]} /> : <span className="h-1.5" />}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {Object.entries(DOT).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', v)} />{k}</span>)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="section-title">Staff register today ({fmt.date(todayISO())})</h3>
          <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
            {[...snap.teachers.map((t) => ({ kind: 'teacher' as const, id: t.id })), ...snap.staff.map((t) => ({ kind: 'staff' as const, id: t.id }))].map((p) => {
              const rec = snap.attendance.find((a) => a.personType === 'employee' && a.employeeId === p.id && a.date === todayISO());
              return (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-slate-700">{employeeName(snap, p.kind, p.id)} <span className="text-xs text-slate-400">({p.kind})</span></span>
                  {rec ? <StatusPill status={rec.status} /> : <Badge tone="slate">Not marked</Badge>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
