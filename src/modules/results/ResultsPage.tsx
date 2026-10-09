import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Plus, Printer, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDB } from '../../lib/db/store';
import {
  classLabel, examResults, gradeDistribution, studentName, subjectAverages,
} from '../../lib/db/selectors';
import type { GradeScale } from '../../lib/db/types';
import { useSchool } from '../../lib/useSchool';
import { exportCSV } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, StatusPill, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

type TabId = 'board' | 'subjects' | 'gradebook' | 'scales';

export function ResultsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<TabId>('board');
  const [examId, setExamId] = useState(params.get('exam') ?? snap.exams[0]?.id ?? '');
  const [classId, setClassId] = useState('');

  const rows = useMemo(() => (examId ? examResults(snap, examId, classId || undefined) : []), [snap, examId, classId]);
  const withMarks = useMemo(() => rows.filter((r) => r.subjects.length), [rows]);
  const dist = useMemo(() => (examId ? gradeDistribution(snap, examId) : []), [snap, examId]);
  const avgs = useMemo(() => (examId ? subjectAverages(snap, examId, classId || undefined) : []), [snap, examId, classId]);
  const exam = snap.exams.find((e) => e.id === examId);
  const passRate = withMarks.length ? Math.round((withMarks.filter((r) => r.passed).length / withMarks.length) * 100) : 0;

  const subjects = useMemo(() => {
    const ids = new Set<string>();
    withMarks.forEach((r) => r.subjects.forEach((s) => ids.add(s.subjectId)));
    return [...ids].map((id) => ({ id, name: snap.subjects.find((s) => s.id === id)?.name ?? '—' }));
  }, [snap, withMarks]);

  return (
    <div>
      <PageHeader
        title="Results & Report Cards"
        subtitle={exam ? `${exam.name} · ${exam.term} · ${passRate}% pass rate` : 'Select an exam'}
        actions={
          <button
            type="button" className="btn-secondary"
            onClick={() => {
              exportCSV(`results-${exam?.name ?? 'all'}`, ['Rank', 'Student', 'ID', 'Class', 'Total', 'Max', '%', 'Grade', 'Result'],
                withMarks.map((r) => [r.rank, studentName(r.student), r.student.studentId, classLabel(snap, r.student.classId), r.total, r.max, r.pct, r.grade, r.passed ? 'Pass' : 'Fail']));
              toast.success('Results exported');
            }}
          >
            <Download className="h-4 w-4" /> Export
          </button>
        }
      />
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="input">
            {snap.exams.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.term}</option>)}
          </select>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input">
            <option value="">All classes</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid gap-2 px-3 pt-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-xl font-bold">{withMarks.length}</p><p className="text-xs text-slate-500">Students graded</p></div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center"><p className="text-xl font-bold text-emerald-700">{withMarks.filter((r) => r.passed).length}</p><p className="text-xs text-slate-500">Passed</p></div>
          <div className="rounded-lg bg-red-50 p-3 text-center"><p className="text-xl font-bold text-red-700">{withMarks.filter((r) => !r.passed).length}</p><p className="text-xs text-slate-500">Failed</p></div>
          <div className="rounded-lg bg-blue-50 p-3 text-center"><p className="text-xl font-bold text-blue-700">{withMarks.length ? Math.round((withMarks.reduce((a, r) => a + r.pct, 0) / withMarks.length) * 10) / 10 : 0}%</p><p className="text-xs text-slate-500">Average</p></div>
        </div>
        <div className="p-3">
          <Tabs<TabId>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'board', label: 'Leaderboard' },
              { id: 'subjects', label: 'Subject analysis' },
              { id: 'gradebook', label: 'Grade book' },
              { id: 'scales', label: 'Grading scales' },
            ]}
          />
        </div>

        {tab === 'board' ? (
          <DataTable
            columns={[
              { key: 'rank', header: 'Rank', render: (r: (typeof rows)[number]) => r.rank ? <Badge tone={r.rank <= 3 ? 'amber' : 'slate'}>#{r.rank}</Badge> : <span className="text-slate-300">—</span>, sortValue: (r) => r.rank || 9999 },
              { key: 'student', header: 'Student', render: (r) => <Link to={`/students/${r.student.id}`} className="link">{studentName(r.student)}</Link>, sortValue: (r) => studentName(r.student) },
              { key: 'class', header: 'Class', render: (r) => classLabel(snap, r.student.classId, r.student.sectionId) },
              { key: 'total', header: 'Total', render: (r) => (r.subjects.length ? `${r.total} / ${r.max}` : '—'), sortValue: (r) => r.total },
              { key: 'pct', header: '%', render: (r) => (r.subjects.length ? `${r.pct}%` : '—'), sortValue: (r) => r.pct },
              { key: 'grade', header: 'Grade', render: (r) => (r.subjects.length ? <Badge tone={r.passed ? 'green' : 'red'}>{r.grade}{school.gpaEnabled && r.gpa !== null ? ` · ${r.gpa}` : ''}</Badge> : <span className="text-slate-300">—</span>) },
              { key: 'result', header: 'Result', render: (r) => (r.subjects.length ? <StatusPill status={r.passed ? 'Passed' : 'Failed'} /> : <Badge tone="slate">No marks</Badge>) },
              {
                key: 'actions', header: 'Report', className: 'text-right',
                render: (r) => r.subjects.length ? <Link to={`/print/report-card/${r.student.id}/${examId}`} className="btn-secondary !py-1 text-xs"><Printer className="h-3.5 w-3.5" /> Card</Link> : null,
              },
            ]}
            data={rows}
            keyOf={(r) => r.student.id}
            pageSize={15}
            emptyTitle="No students in scope"
          />
        ) : null}

        {tab === 'subjects' ? (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div>
              <h3 className="section-title mb-2">Average score by subject</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgs} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="subject" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Average']} />
                    <Bar dataKey="avg" fill={school.primaryColor} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="section-title mb-2">Grade distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill={school.accentColor} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'gradebook' ? (
          <div className="overflow-x-auto p-3">
            {subjects.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No marks entered for this exam yet.</p> : (
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="table-head">
                    <th className="px-3 py-2 text-left">Student</th>
                    {subjects.map((s) => <th key={s.id} className="px-3 py-2 text-center">{s.name}</th>)}
                    <th className="px-3 py-2 text-center">Total</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withMarks.map((r) => (
                    <tr key={r.student.id} className="hover:bg-slate-50">
                      <td className="table-cell"><Link to={`/students/${r.student.id}`} className="link">{studentName(r.student)}</Link></td>
                      {subjects.map((s) => {
                        const cell = r.subjects.find((x) => x.subjectId === s.id);
                        return <td key={s.id} className="table-cell text-center">{cell ? (cell.absent ? <Badge tone="red">AB</Badge> : `${cell.obtained}`) : <span className="text-slate-300">—</span>}</td>;
                      })}
                      <td className="table-cell text-center font-bold">{r.total}</td>
                      <td className="table-cell text-center"><Badge tone={r.passed ? 'green' : 'red'}>{r.grade}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {tab === 'scales' ? <ScalesTab /> : null}
      </Card>
    </div>
  );
}

export function ScalesTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const remove = useDB((s) => s.remove);
  const school = useSchool();
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: GradeScale } | null>(null);
  const [deleting, setDeleting] = useState<GradeScale | null>(null);
  const [f, setF] = useState({ name: '', minPercent: '0', maxPercent: '100', grade: '', gpa: '', remarks: '' });

  const openAdd = (): void => {
    setF({ name: '', minPercent: '0', maxPercent: '100', grade: '', gpa: '', remarks: '' });
    setModal({ mode: 'add' });
  };
  const openEdit = (row: GradeScale): void => {
    setF({ name: row.name, minPercent: String(row.minPercent), maxPercent: String(row.maxPercent), grade: row.grade, gpa: row.gpa !== undefined ? String(row.gpa) : '', remarks: row.remarks ?? '' });
    setModal({ mode: 'edit', row });
  };

  const save = (): void => {
    if (!f.grade.trim() || !f.name.trim()) {
      toast.error('Name and grade are required');
      return;
    }
    const payload = {
      name: f.name.trim(), minPercent: Number(f.minPercent) || 0, maxPercent: Number(f.maxPercent) || 0,
      grade: f.grade.trim().toUpperCase(), gpa: f.gpa === '' ? undefined : Number(f.gpa), remarks: f.remarks.trim() || undefined,
    };
    if (modal?.row) {
      update('gradeScales', modal.row.id, payload);
      toast.success('Scale updated — results recalculate automatically');
    } else {
      create('gradeScales', payload);
      toast.success('Grade added');
    }
    setModal(null);
  };

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">Boundaries apply instantly to all results, report cards and analytics. GPA {school.gpaEnabled ? 'enabled' : 'disabled'} (Settings → Academic).</p>
        <button type="button" className="btn-primary !py-1.5 text-xs" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add grade</button>
      </div>
      <DataTable
        columns={[
          { key: 'grade', header: 'Grade', render: (g: GradeScale) => <Badge tone="blue">{g.grade}</Badge>, sortValue: (g) => -g.minPercent },
          { key: 'name', header: 'Label', render: (g: GradeScale) => g.name },
          { key: 'range', header: 'Range %', render: (g: GradeScale) => `${g.minPercent} – ${g.maxPercent}` },
          { key: 'gpa', header: 'GPA', render: (g: GradeScale) => (school.gpaEnabled ? (g.gpa ?? '—') : <span className="text-slate-300">off</span>) },
          { key: 'remarks', header: 'Remarks', render: (g: GradeScale) => g.remarks ?? '—' },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (g: GradeScale) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(g)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(g)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={[...snap.gradeScales].sort((a, b) => b.minPercent - a.minPercent)}
        keyOf={(g) => g.id}
        pageSize={12}
        emptyTitle="No grading scales"
      />
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit grade' : 'Add grade'}
        footer={<><button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Excellent" /></Field>
          <Field label="Grade"><input className="input" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} placeholder="A+" /></Field>
          <Field label="Min %"><input type="number" className="input" value={f.minPercent} onChange={(e) => setF({ ...f, minPercent: e.target.value })} /></Field>
          <Field label="Max %"><input type="number" className="input" value={f.maxPercent} onChange={(e) => setF({ ...f, maxPercent: e.target.value })} /></Field>
          <Field label="GPA" optional><input type="number" step="0.1" className="input" value={f.gpa} onChange={(e) => setF({ ...f, gpa: e.target.value })} /></Field>
          <Field label="Remarks" optional><input className="input" value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleting} title={`Delete grade ${deleting?.grade}?`} message="Results using this grade will fall back to the nearest remaining band." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('gradeScales', deleting.id); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}
