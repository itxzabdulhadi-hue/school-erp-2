import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, subjectAverages, teacherName } from '../../lib/db/selectors';
import { useFmt, useMoney } from '../../lib/useSchool';
import { Avatar, Badge, Card, CardHeader, EmptyState, ProgressBar, StatusPill } from '../../components/ui/primitives';

export function TeacherProfilePage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const fmt = useFmt();
  const money = useMoney();
  const { id } = useParams();
  const navigate = useNavigate();

  const teacher = snap.teachers.find((t) => t.id === id);
  const att = useMemo(() => {
    const recs = teacher ? snap.attendance.filter((a) => a.personType === 'employee' && a.employeeId === teacher.id) : [];
    const present = recs.filter((r) => r.status === 'present' || r.status === 'half-day').length;
    const pct = recs.length ? Math.round((present / recs.length) * 1000) / 10 : 0;
    return { recs: [...recs].sort((a, b) => b.date.localeCompare(a.date)), present, total: recs.length, pct };
  }, [snap, teacher]);
  const leaves = useMemo(() => (teacher ? snap.leaves.filter((l) => l.personType === 'teacher' && l.employeeId === teacher.id) : []), [snap, teacher]);
  const assignments = useMemo(() => (teacher ? snap.classSubjects.filter((c) => c.teacherId === teacher.id) : []), [snap, teacher]);
  const slots = useMemo(() => (teacher ? snap.timetable.filter((t) => t.teacherId === teacher.id) : []), [snap, teacher]);
  const latestExam = useMemo(() => {
    const withMarks = snap.exams.filter((e) => snap.marks.some((m) => m.examId === e.id)).sort((a, b) => b.endDate.localeCompare(a.endDate));
    return withMarks[0];
  }, [snap]);
  const perf = useMemo(() => {
    if (!latestExam || !teacher) return [];
    const avgs = subjectAverages(snap, latestExam.id);
    return teacher.subjectIds
      .map((sid) => ({ subject: snap.subjects.find((s) => s.id === sid)?.name ?? '', avg: avgs.find((a) => a.subject === snap.subjects.find((s) => s.id === sid)?.name)?.avg ?? 0 }))
      .filter((x) => x.subject);
  }, [snap, latestExam, teacher]);

  if (!teacher) {
    return (
      <div>
        <button type="button" className="btn-ghost mb-4" onClick={() => navigate('/teachers')}><ArrowLeft className="h-4 w-4" /> Back</button>
        <EmptyState title="Teacher not found" action={<Link to="/teachers" className="btn-primary">All teachers</Link>} />
      </div>
    );
  }

  const periodsPerWeek = assignments.reduce((a, c) => a + (c.weeklyPeriods ?? 0), 0);
  const classTeacherOf = [...snap.classes.filter((c) => c.classTeacherId === teacher.id).map((c) => `${c.name} (class)`),
    ...snap.sections.filter((s) => s.classTeacherId === teacher.id).map((s) => classLabel(snap, s.classId, s.id))];

  return (
    <div>
      <button type="button" className="btn-ghost mb-4" onClick={() => navigate('/teachers')}><ArrowLeft className="h-4 w-4" /> Back to teachers</button>
      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row">
          <Avatar name={teacherName(teacher)} size="xl" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{teacherName(teacher)}</h1>
              <StatusPill status={teacher.status} />
            </div>
            <p className="page-sub">{teacher.employeeId} · {teacher.designation ?? 'Teacher'} · {snap.departments.find((d) => d.id === teacher.departmentId)?.name ?? '—'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">Classes assigned</p><p className="text-base font-bold">{new Set(assignments.map((a) => a.classId)).size}</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">Periods / week</p><p className="text-base font-bold">{periodsPerWeek}</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">Attendance</p><p className="text-base font-bold">{att.pct}%</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">Leaves taken</p><p className="text-base font-bold">{leaves.filter((l) => l.status === 'approved').length}</p></div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 p-5 pt-3">
            {[['Phone', teacher.phone], ['Email', teacher.email ?? '—'], ['Qualification', teacher.qualification ?? '—'], ['Specialization', teacher.specialization ?? '—'], ['Joining date', fmt.date(teacher.joiningDate)], ['Address', teacher.address ?? '—']].map(([k, v]) => (
              <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt><dd className="text-sm">{v}</dd></div>
            ))}
          </dl>
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subjects</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {teacher.subjectIds.map((sid) => <Badge key={sid} tone="blue">{snap.subjects.find((s) => s.id === sid)?.name}</Badge>)}
              {teacher.subjectIds.length === 0 ? <span className="text-sm text-slate-400">None assigned</span> : null}
            </div>
          </div>
          {classTeacherOf.length ? (
            <div className="border-t border-slate-100 px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Class teacher of</p>
              <div className="mt-1 flex flex-wrap gap-1.5">{classTeacherOf.map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>
            </div>
          ) : null}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Assigned workload" subtitle={`${assignments.length} class-subject assignments · ${slots.length} timetable slots`} />
            <ul className="max-h-56 divide-y divide-slate-50 overflow-y-auto">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-2 text-sm">
                  <span>{classLabel(snap, a.classId, a.sectionId)} — {snap.subjects.find((s) => s.id === a.subjectId)?.name}</span>
                  <span className="text-xs text-slate-500">{a.weeklyPeriods ?? 0}/wk</span>
                </li>
              ))}
              {assignments.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No teaching assignments yet.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Salary information" />
            <div className="px-5 py-3 text-sm">
              <p>Monthly salary: <span className="font-bold">{teacher.salaryMonthly ? money(teacher.salaryMonthly) : '—'}</span></p>
              <p className="mt-0.5 text-xs text-slate-500">Payroll processing can be connected in a future release.</p>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Attendance" subtitle={`${att.present}/${att.total} present`} />
          <div className="px-5 py-3">
            <div className="flex items-center gap-3">
              <ProgressBar value={att.pct} className="flex-1" />
              <span className="text-sm font-bold">{att.pct}%</span>
            </div>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {att.recs.slice(0, 12).map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs"><span className="text-slate-500">{fmt.date(r.date)}</span><StatusPill status={r.status} /></li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Leaves" subtitle={`${leaves.length} requests`} action={<Link to="/leaves" className="link text-xs">Manage</Link>} />
          <ul className="divide-y divide-slate-50">
            {leaves.slice(0, 6).map((l) => (
              <li key={l.id} className="flex items-center justify-between px-5 py-2 text-sm">
                <span>{l.leaveType}<span className="block text-xs text-slate-400">{fmt.date(l.startDate)} → {fmt.date(l.endDate)}</span></span>
                <StatusPill status={l.status} />
              </li>
            ))}
            {leaves.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No leave requests.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Subject performance" subtitle={latestExam ? latestExam.name : 'No exams yet'} />
          <ul className="space-y-2 px-5 py-3">
            {perf.map((p) => (
              <li key={p.subject}>
                <div className="flex justify-between text-xs"><span className="font-medium">{p.subject}</span><span className="font-bold">{p.avg}%</span></div>
                <ProgressBar value={p.avg} className="mt-1" />
              </li>
            ))}
            {perf.length === 0 ? <li className="py-4 text-sm text-slate-400">No results linked to this teacher's subjects.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
