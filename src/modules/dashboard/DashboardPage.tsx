import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Award, Bell, BookOpen, Briefcase, CalendarRange,
  ClipboardCheck, GraduationCap, Megaphone, School, Users, Wallet,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useDB } from '../../lib/db/store';
import {
  attendanceTrend, borrowerName, classLabel, dashboard, examResults,
  feeCollectionTrend, financeSummary, gradeDistribution, populationByClass,
  populationByGender, studentName,
} from '../../lib/db/selectors';
import { useFmt, useMoney, useSchool } from '../../lib/useSchool';
import { addDaysISO, todayISO } from '../../lib/utils';
import { Badge, Card, CardHeader, PageHeader, StatCard, StatusPill } from '../../components/ui/primitives';

const PIE_COLORS = ['#1d4ed8', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

type RangeKey = 'today' | '7d' | '30d' | 'term';

const RANGES: { id: RangeKey; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'term', label: 'This term' },
];

export function DashboardPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const money = useMoney();
  const fmt = useFmt();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('30d');
  const [perfExam, setPerfExam] = useState<string>('');

  const t = todayISO();
  const { from, to, trendDays } = useMemo(() => {
    if (range === 'today') return { from: t, to: t, trendDays: 7 };
    if (range === '7d') return { from: addDaysISO(t, -6), to: t, trendDays: 7 };
    if (range === '30d') return { from: addDaysISO(t, -29), to: t, trendDays: 14 };
    return { from: t.slice(0, 7) + '-01', to: t, trendDays: 30 };
  }, [range, t]);

  const stats = useMemo(() => dashboard(snap), [snap]);
  const fin = useMemo(() => financeSummary(snap, from, to), [snap, from, to]);
  const trend = useMemo(() => feeCollectionTrend(snap, trendDays), [snap, trendDays]);
  const attTrend = useMemo(() => attendanceTrend(snap, 14), [snap]);
  const popClass = useMemo(() => populationByClass(snap), [snap]);
  const popGender = useMemo(() => populationByGender(snap), [snap]);

  const examsWithMarks = useMemo(
    () => snap.exams.filter((e) => snap.marks.some((m) => m.examId === e.id)),
    [snap],
  );
  const activeExamId = perfExam || examsWithMarks[0]?.id || '';
  const perf = useMemo(() => {
    if (!activeExamId) return null;
    const rows = examResults(snap, activeExamId).filter((r) => r.subjects.length);
    const passed = rows.filter((r) => r.passed).length;
    const avg = rows.length ? rows.reduce((a, r) => a + r.pct, 0) / rows.length : 0;
    return { rows: rows.length, passed, failed: rows.length - passed, avg: Math.round(avg * 10) / 10, dist: gradeDistribution(snap, activeExamId) };
  }, [snap, activeExamId]);

  const primary = school.primaryColor;

  return (
    <div>
      <PageHeader
        title={`${school.name} Dashboard`}
        subtitle={`${school.academicYear} · ${school.currentTerm} · ${fmt.date(t)}`}
        actions={
          <>
            <Link to="/reports" className="btn-secondary">View reports</Link>
            <Link to="/students" className="btn-primary">Admit student</Link>
          </>
        }
      />

      {/* Stat rows */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Total students" value={String(stats.totals.students)} sub={`${stats.totals.classes} classes · ${stats.totals.sections} sections`} tone="bg-blue-100 text-blue-700" onClick={() => navigate('/students')} />
        <StatCard icon={Users} label="Teachers" value={String(stats.totals.teachers)} sub={`${stats.totals.staff} support staff`} tone="bg-violet-100 text-violet-700" onClick={() => navigate('/teachers')} />
        <StatCard icon={Briefcase} label="Staff" value={String(stats.totals.staff)} sub={`${stats.pendingLeaves} pending leaves`} tone="bg-cyan-100 text-cyan-700" onClick={() => navigate('/staff')} />
        <StatCard icon={School} label="Classes" value={String(stats.totals.classes)} sub={`${stats.totals.sections} sections`} tone="bg-emerald-100 text-emerald-700" onClick={() => navigate('/classes')} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ClipboardCheck} label="Today's attendance" value={`${stats.attendance.pct}%`} sub={`${stats.attendance.total} marked`} tone="bg-emerald-100 text-emerald-700" onClick={() => navigate('/attendance')} />
        <StatCard icon={Users} label="Present / Late" value={`${stats.attendance.present}`} sub={`${stats.attendance.late} late · ${stats.attendance.excused} excused`} tone="bg-blue-100 text-blue-700" onClick={() => navigate('/attendance')} />
        <StatCard icon={AlertTriangle} label="Absent today" value={String(stats.attendance.absent)} sub={`${stats.lowAttendance.length} low-attendance alerts`} tone="bg-red-100 text-red-700" onClick={() => navigate('/attendance')} />
        <StatCard icon={BookOpen} label="Library out" value={String(stats.booksOut)} sub={`${stats.totals.books} total books`} tone="bg-amber-100 text-amber-700" onClick={() => navigate('/library')} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Collected today" value={money(stats.financeToday.collected)} sub={`${stats.financeToday.count} receipts`} tone="bg-emerald-100 text-emerald-700" onClick={() => navigate('/fees')} />
        <StatCard icon={Wallet} label="Collected this month" value={money(stats.financeMonth.collected)} sub={`${stats.financeMonth.count} receipts`} tone="bg-blue-100 text-blue-700" onClick={() => navigate('/fees')} />
        <StatCard icon={Wallet} label="Outstanding fees" value={money(stats.financeAll.outstanding)} sub={`${stats.overdueCount} overdue invoices`} tone="bg-amber-100 text-amber-700" onClick={() => navigate('/fees')} />
        <StatCard icon={Award} label="Pass rate (latest exam)" value={perf ? `${perf.rows ? Math.round((perf.passed / perf.rows) * 100) : 0}%` : '—'} sub={perf ? `${perf.passed}/${perf.rows} passed` : 'No results yet'} tone="bg-violet-100 text-violet-700" onClick={() => navigate('/results')} />
      </div>

      {/* Finance + attendance */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Fee collection"
            subtitle={`Collected ${money(fin.collected)} · Invoiced ${money(fin.invoiced)} · Discounts ${money(fin.discounts)} · Fines ${money(fin.fines)}`}
            action={
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRange(r.id)}
                    className={range === r.id ? 'rounded-lg bg-[var(--brand-primary)] px-2.5 py-1 text-xs font-semibold text-white' : 'rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200'}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [money(Number(v)), 'Collected']} />
                <Bar dataKey="amount" fill={primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Upcoming exams" action={<Link to="/exams" className="link text-xs">All exams</Link>} />
          <ul className="divide-y divide-slate-50">
            {stats.upcomingExams.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{e.name}</p>
                  <p className="text-xs text-slate-500">{fmt.date(e.startDate)} → {fmt.date(e.endDate)}</p>
                </div>
                <StatusPill status={e.status} />
              </li>
            ))}
            {stats.upcomingExams.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No upcoming exams.</li> : null}
          </ul>
        </Card>
      </div>

      {/* Attendance trend + gender */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Attendance overview" subtitle="Daily attendance rate · last 14 days" action={<Link to="/attendance" className="link text-xs">Open attendance</Link>} />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => (name === 'pct' ? [`${v}%`, 'Rate'] : [v, name])} />
                <Area type="monotone" dataKey="pct" stroke={primary} fill={primary} fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Student demographics" subtitle="By gender" />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={popGender} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3}>
                  {popGender.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Population + performance */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Student population" subtitle="Active students per class" action={<Link to="/classes" className="link text-xs">Manage classes</Link>} />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popClass} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="students" fill={school.accentColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Academic performance"
            action={
              <select value={activeExamId} onChange={(e) => setPerfExam(e.target.value)} className="input !w-auto !py-1 text-xs">
                {examsWithMarks.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            }
          />
          {perf ? (
            <div className="px-4 py-3 sm:px-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-lg font-bold text-slate-900">{perf.avg}%</p><p className="text-[11px] text-slate-500">Average</p></div>
                <div className="rounded-lg bg-emerald-50 p-2"><p className="text-lg font-bold text-emerald-700">{perf.passed}</p><p className="text-[11px] text-slate-500">Passed</p></div>
                <div className="rounded-lg bg-red-50 p-2"><p className="text-lg font-bold text-red-700">{perf.failed}</p><p className="text-[11px] text-slate-500">Failed</p></div>
              </div>
              <div className="mt-3 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perf.dist}>
                    <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                    <Tooltip />
                    <Bar dataKey="count" fill={primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Link to="/results" className="link mt-1 inline-flex items-center gap-1 text-xs">Full results <ArrowRight className="h-3 w-3" /></Link>
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-slate-400">No exam results yet.</p>
          )}
        </Card>
      </div>

      {/* Lists */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Upcoming events" action={<Link to="/events" className="link flex items-center gap-1 text-xs"><CalendarRange className="h-3.5 w-3.5" /> Calendar</Link>} />
          <ul className="divide-y divide-slate-50">
            {stats.upcomingEvents.map((e) => (
              <li key={e.id} className="px-4 py-2.5 sm:px-5">
                <p className="truncate text-sm font-medium text-slate-800">{e.title}</p>
                <p className="text-xs text-slate-500">{fmt.date(e.date)}{e.startTime ? ` · ${fmt.time(e.startTime)}` : ''} · {e.location}</p>
              </li>
            ))}
            {stats.upcomingEvents.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No upcoming events.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Announcements" action={<Link to="/announcements" className="link flex items-center gap-1 text-xs"><Megaphone className="h-3.5 w-3.5" /> All</Link>} />
          <ul className="divide-y divide-slate-50">
            {stats.recentAnnouncements.map((a) => (
              <li key={a.id} className="px-4 py-2.5 sm:px-5">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
                  {a.priority === 'urgent' || a.priority === 'high' ? <Badge tone={a.priority === 'urgent' ? 'red' : 'amber'}>{a.priority}</Badge> : null}
                </div>
                <p className="text-xs text-slate-500">{fmt.date(a.publishDate)} · {a.category}</p>
              </li>
            ))}
            {stats.recentAnnouncements.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No announcements.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent admissions" action={<Link to="/students" className="link text-xs">All students</Link>} />
          <ul className="divide-y divide-slate-50">
            {stats.recentAdmissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <Link to={`/students/${s.id}`} className="link truncate text-sm">{studentName(s)}</Link>
                  <p className="text-xs text-slate-500">{classLabel(snap, s.classId, s.sectionId)} · {s.studentId}</p>
                </div>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent payments" action={<Link to="/fees" className="link text-xs">Finance</Link>} />
          <ul className="divide-y divide-slate-50">
            {stats.recentPayments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{borrowerName(snap, 'student', p.studentId)}</p>
                  <p className="text-xs text-slate-500">{p.receiptNo} · {fmt.date(p.paymentDate)} · {p.method}</p>
                </div>
                <p className="text-sm font-bold text-emerald-700">{money(p.amount)}</p>
              </li>
            ))}
            {stats.recentPayments.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No payments yet.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Low-attendance alerts" action={<Link to="/attendance" className="link flex items-center gap-1 text-xs"><Bell className="h-3.5 w-3.5" /> Details</Link>} />
          <ul className="divide-y divide-slate-50">
            {stats.lowAttendance.map(({ student, pct }) => (
              <li key={student.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <Link to={`/students/${student.id}`} className="link truncate text-sm">{studentName(student)}</Link>
                  <p className="text-xs text-slate-500">{classLabel(snap, student.classId, student.sectionId)}</p>
                </div>
                <Badge tone={pct < 60 ? 'red' : 'amber'}>{pct}%</Badge>
              </li>
            ))}
            {stats.lowAttendance.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No alerts — attendance is healthy.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
