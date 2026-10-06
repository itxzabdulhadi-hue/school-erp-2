import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import {
  classLabel, examResults, studentAttendanceStats, studentName, studentOutstanding, subjectName,
} from '../../lib/db/selectors';
import { gradeFor } from '../../lib/grading';
import { useFmt, useMoney, useSchool } from '../../lib/useSchool';
import { calcAge } from '../../lib/utils';
import { Avatar, Badge, Card, CardHeader, EmptyState, ProgressBar, StatusPill, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import type { AttendanceRecord } from '../../lib/db/types';

type TabId = 'overview' | 'attendance' | 'fees' | 'academics' | 'homework' | 'discipline' | 'library' | 'documents';

export function StudentProfilePage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const money = useMoney();
  const fmt = useFmt();
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('overview');

  const student = snap.students.find((s) => s.id === id);
  const stats = useMemo(() => (student ? studentAttendanceStats(snap, student.id) : null), [snap, student]);
  const recs = useMemo(
    () => (student ? snap.attendance.filter((a) => a.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [snap, student],
  );
  const invoices = useMemo(() => (student ? snap.invoices.filter((i) => i.studentId === student.id) : []), [snap, student]);
  const pays = useMemo(() => (student ? snap.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)) : []), [snap, student]);
  const guardians = useMemo(() => (student ? snap.guardians.filter((g) => g.studentId === student.id) : []), [snap, student]);
  const discipline = useMemo(() => (student ? snap.discipline.filter((d) => d.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date)) : []), [snap, student]);
  const docs = useMemo(() => (student ? snap.documents.filter((d) => d.entityType === 'student' && d.entityId === student.id) : []), [snap, student]);
  const libTxns = useMemo(() => (student ? snap.libraryTxns.filter((t) => t.borrowerType === 'student' && t.borrowerId === student.id) : []), [snap, student]);
  const homework = useMemo(
    () => (student ? snap.assignments.filter((a) => a.classId === student.classId && (!a.sectionId || a.sectionId === student.sectionId)) : []),
    [snap, student],
  );

  if (!student) {
    return (
      <div>
        <button type="button" className="btn-ghost mb-4" onClick={() => navigate('/students')}><ArrowLeft className="h-4 w-4" /> Back to students</button>
        <EmptyState title="Student not found" hint="This record may have been deleted." action={<Link to="/students" className="btn-primary">All students</Link>} />
      </div>
    );
  }

  const due = studentOutstanding(snap, student.id);
  const route = snap.routes.find((r) => r.id === student.routeId);
  const age = calcAge(student.dob);

  const meta: [string, string][] = [
    ['Student ID', student.studentId],
    ['Admission no', student.admissionNo],
    ['Roll no', student.rollNo ?? '—'],
    ['Class', classLabel(snap, student.classId, student.sectionId)],
    ['Gender', student.gender],
    ['Date of birth', `${fmt.date(student.dob)}${age !== null ? ` (${age} yrs)` : ''}`],
    ['Blood group', student.bloodGroup ?? '—'],
    ['Nationality', student.nationality ?? '—'],
    ...(school.religionFieldEnabled ? [['Religion', student.religion ?? '—'] as [string, string]] : []),
    ['Phone', student.phone ?? '—'],
    ['Email', student.email ?? '—'],
    ['City', student.city ?? '—'],
    ['Address', student.address ?? '—'],
    ['Previous school', student.previousSchool ?? '—'],
    ['Admission date', fmt.date(student.admissionDate)],
  ];

  const attColumns = [
    { key: 'date', header: 'Date', render: (a: AttendanceRecord) => fmt.date(a.date), sortValue: (a: AttendanceRecord) => a.date },
    { key: 'status', header: 'Status', render: (a: AttendanceRecord) => <StatusPill status={a.status} /> },
    { key: 'remarks', header: 'Remarks', render: (a: AttendanceRecord) => a.remarks ?? '—' },
  ];

  return (
    <div>
      <button type="button" className="btn-ghost mb-4" onClick={() => navigate('/students')}><ArrowLeft className="h-4 w-4" /> Back to students</button>

      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <Avatar name={studentName(student)} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{studentName(student)}</h1>
              {student.archived ? <Badge tone="slate">Archived</Badge> : <StatusPill status={student.status} />}
            </div>
            <p className="page-sub">{student.studentId} · {classLabel(snap, student.classId, student.sectionId)}{student.rollNo ? ` · Roll ${student.rollNo}` : ''}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">Attendance</p><p className="text-base font-bold text-slate-900">{stats?.pct ?? 0}%</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">Outstanding fees</p><p className={`text-base font-bold ${due > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{money(due)}</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">Discipline notes</p><p className="text-base font-bold text-slate-900">{discipline.length}</p></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">Books on loan</p><p className="text-base font-bold text-slate-900">{libTxns.filter((t) => t.status === 'issued' || t.status === 'overdue').length}</p></div>
            </div>
          </div>
          <div className="flex gap-2 sm:flex-col">
            <button type="button" className="btn-secondary" onClick={() => navigate(`/students?edit=${student.id}`)}><Pencil className="h-4 w-4" /> Edit</button>
            <button type="button" className="btn-secondary" onClick={() => navigate(`/print/student/${student.id}`)}><Printer className="h-4 w-4" /> Print</button>
          </div>
        </div>
        <div className="px-3 sm:px-5">
          <Tabs<TabId>
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'attendance', label: 'Attendance', count: recs.length },
              { id: 'fees', label: 'Fees', count: invoices.length },
              { id: 'academics', label: 'Exams' },
              { id: 'homework', label: 'Homework', count: homework.length },
              { id: 'discipline', label: 'Discipline', count: discipline.length },
              { id: 'library', label: 'Library & Transport' },
              { id: 'documents', label: 'Documents', count: docs.length },
            ]}
          />
        </div>
      </Card>

      <div className="mt-4">
        {tab === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Personal information" />
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 p-5 pt-3 sm:grid-cols-2">
                {meta.map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt><dd className="text-sm text-slate-800">{v}</dd></div>
                ))}
              </dl>
              {student.notes ? <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600"><span className="font-semibold">Notes: </span>{student.notes}</p> : null}
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader title="Guardians" subtitle={`${guardians.length} linked`} />
                <ul className="divide-y divide-slate-50">
                  {guardians.map((g) => (
                    <li key={g.id} className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                        <Badge tone="blue">{g.relationship}</Badge>
                        {g.isPrimary ? <Badge tone="green">Primary</Badge> : null}
                        {g.isEmergency ? <Badge tone="red">Emergency</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{g.phone}{g.email ? ` · ${g.email}` : ''}{g.occupation ? ` · ${g.occupation}` : ''}</p>
                    </li>
                  ))}
                  {guardians.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No guardians linked.</li> : null}
                </ul>
              </Card>
              <Card>
                <CardHeader title="Transport" />
                <div className="px-5 py-3 text-sm text-slate-700">
                  {route ? (
                    <div className="space-y-1">
                      <p><span className="font-semibold">{route.name}</span> ({route.code}) · Fare {money(route.fare)}/mo</p>
                      <p className="text-xs text-slate-500">Pickup: {student.pickupPoint ?? '—'} · Drop-off: {student.dropPoint ?? '—'}</p>
                      <Link to="/transport" className="link text-xs">Manage transport</Link>
                    </div>
                  ) : <p className="text-slate-400">No transport assigned. <button type="button" className="link" onClick={() => navigate(`/students?edit=${student.id}`)}>Assign</button></p>}
                </div>
              </Card>
            </div>
          </div>
        ) : null}

        {tab === 'attendance' ? (
          <Card>
            <CardHeader title="Attendance history" subtitle={`${stats?.present ?? 0} present · ${stats?.absent ?? 0} absent · ${stats?.late ?? 0} late · ${stats?.excused ?? 0} excused`} />
            <div className="px-5 pt-3">
              <div className="flex items-center gap-3">
                <ProgressBar value={stats?.pct ?? 0} className="flex-1" tone={(stats?.pct ?? 0) < 75 ? 'bg-red-500' : (stats?.pct ?? 0) < 85 ? 'bg-amber-500' : 'bg-emerald-500'} />
                <span className="text-sm font-bold">{stats?.pct ?? 0}%</span>
              </div>
            </div>
            <DataTable columns={attColumns} data={recs} keyOf={(a) => a.id} pageSize={15} emptyTitle="No attendance records" />
          </Card>
        ) : null}

        {tab === 'fees' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Invoices" action={<Link to="/fees" className="link text-xs">Open finance</Link>} />
              <ul className="divide-y divide-slate-50">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{inv.invoiceNo} <span className="text-xs text-slate-400">· due {fmt.date(inv.dueDate)}</span></p>
                      <p className="text-xs text-slate-500">{money(inv.paid)} paid of {money(inv.total)}</p>
                    </div>
                    <StatusPill status={inv.status} />
                  </li>
                ))}
                {invoices.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No invoices yet.</li> : null}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Payments" subtitle={pays.length ? `${pays.length} receipts` : undefined} />
              <ul className="divide-y divide-slate-50">
                {pays.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.receiptNo}</p>
                      <p className="text-xs text-slate-500">{fmt.date(p.paymentDate)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-700">{money(p.amount)}</p>
                  </li>
                ))}
                {pays.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No payments yet.</li> : null}
              </ul>
            </Card>
          </div>
        ) : null}

        {tab === 'academics' ? (
          <div className="space-y-4">
            {snap.exams.map((exam) => {
              const rows = examResults(snap, exam.id);
              const row = rows.find((r) => r.student.id === student.id);
              if (!row || !row.subjects.length) return null;
              return (
                <Card key={exam.id}>
                  <CardHeader
                    title={exam.name}
                    subtitle={`${exam.term} · Rank ${row.rank || '—'} · ${row.passed ? 'Passed' : 'Failed'}`}
                    action={<Link to={`/print/report-card/${student.id}/${exam.id}`} className="link text-xs">Print report card</Link>}
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="table-head"><th className="px-4 py-2 text-left">Subject</th><th className="px-4 py-2 text-right">Marks</th><th className="px-4 py-2 text-right">%</th><th className="px-4 py-2 text-left">Grade</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {row.subjects.map((s) => {
                          const g = gradeFor(s.absent ? 0 : (s.obtained / s.max) * 100, snap.gradeScales);
                          return (
                            <tr key={s.subjectId}>
                              <td className="table-cell">{subjectName(snap, s.subjectId)}</td>
                              <td className="table-cell text-right">{s.absent ? 'Absent' : `${s.obtained} / ${s.max}`}</td>
                              <td className="table-cell text-right">{s.absent ? '—' : `${Math.round((s.obtained / s.max) * 1000) / 10}%`}</td>
                              <td className="table-cell"><Badge tone={s.absent ? 'red' : g.passed ? 'green' : 'red'}>{s.absent ? 'AB' : g.grade}</Badge></td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="table-cell">Total</td>
                          <td className="table-cell text-right">{row.total} / {row.max}</td>
                          <td className="table-cell text-right">{row.pct}%</td>
                          <td className="table-cell"><Badge tone={row.passed ? 'green' : 'red'}>{row.grade}</Badge></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}

        {tab === 'homework' ? (
          <Card>
            <CardHeader title="Homework" subtitle="Assignments for this student's class" />
            <ul className="divide-y divide-slate-50">
              {homework.map((a) => {
                const sub = a.submissions.find((s) => s.studentId === student.id);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.title}</p>
                      <p className="text-xs text-slate-500">{subjectName(snap, a.subjectId)} · due {fmt.date(a.dueDate)}</p>
                    </div>
                    {sub ? <StatusPill status={sub.status} /> : <Badge tone="slate">Not tracked</Badge>}
                  </li>
                );
              })}
              {homework.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No assignments.</li> : null}
            </ul>
          </Card>
        ) : null}

        {tab === 'discipline' ? (
          <Card>
            <CardHeader title="Discipline records" subtitle="Supportive, factual notes only" action={<Link to="/discipline" className="link text-xs">Manage</Link>} />
            <ul className="divide-y divide-slate-50">
              {discipline.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{d.incidentType}</p>
                    <StatusPill status={d.severity} />
                    <span className="text-xs text-slate-400">{fmt.date(d.date)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{d.description}</p>
                  {d.actionTaken ? <p className="mt-0.5 text-xs text-slate-500">Action: {d.actionTaken}</p> : null}
                </li>
              ))}
              {discipline.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No discipline records. Keep it up!</li> : null}
            </ul>
          </Card>
        ) : null}

        {tab === 'library' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Library history" />
              <ul className="divide-y divide-slate-50">
                {libTxns.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{snap.books.find((b) => b.id === t.bookId)?.title ?? '—'}</p>
                      <p className="text-xs text-slate-500">Issued {fmt.date(t.issueDate)} · due {fmt.date(t.dueDate)}{t.fine ? ` · fine ${money(t.fine)}` : ''}</p>
                    </div>
                    <StatusPill status={t.status} />
                  </li>
                ))}
                {libTxns.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No borrowing history.</li> : null}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Transport" />
              <div className="px-5 py-3 text-sm">
                {route ? (
                  <div className="space-y-1 text-slate-700">
                    <p><span className="font-semibold">{route.name}</span> ({route.code})</p>
                    <p className="text-xs text-slate-500">Pickup {route.pickupTime} · Drop {route.dropTime} · Fare {money(route.fare)}/mo</p>
                    <p className="text-xs">Stops: {route.stops.map((s) => s.name).join(' → ')}</p>
                  </div>
                ) : <p className="text-slate-400">No transport assigned.</p>}
              </div>
            </Card>
          </div>
        ) : null}

        {tab === 'documents' ? (
          <Card>
            <CardHeader title="Documents" action={<Link to="/documents" className="link text-xs">Manage</Link>} />
            <ul className="divide-y divide-slate-50">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-5 py-2.5">
                  <div><p className="text-sm font-medium text-slate-800">{d.name}</p><p className="text-xs text-slate-500">{d.kind}{d.fileSize ? ` · ${d.fileSize}` : ''}</p></div>
                  <Badge tone="slate">{d.fileName ?? 'record'}</Badge>
                </li>
              ))}
              {docs.length === 0 ? <li className="px-5 py-6 text-sm text-slate-400">No documents uploaded.</li> : null}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
