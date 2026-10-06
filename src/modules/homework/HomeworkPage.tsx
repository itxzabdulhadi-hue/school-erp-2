import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, studentName, studentsOfClass, teacherName } from '../../lib/db/selectors';
import type { Assignment, AssignmentStatus, SubmissionStatus } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { matchesQuery, nowISO, todayISO } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatusPill } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

export function HomeworkPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: Assignment } | null>(null);
  const [viewing, setViewing] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState<Assignment | null>(null);

  const filtered = useMemo(
    () => [...snap.assignments].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
      .filter((a) => (!classId || a.classId === classId) && (!status || a.status === status) && matchesQuery(q, a.title, a.description)),
    [snap, q, classId, status],
  );

  const summary = (a: Assignment): { done: number; total: number; late: number } => ({
    done: a.submissions.filter((s) => s.status === 'submitted' || s.status === 'graded').length,
    total: a.submissions.length,
    late: a.submissions.filter((s) => s.status === 'late').length,
  });

  return (
    <div>
      <PageHeader
        title="Homework & Assignments"
        subtitle="Create work, track submissions and close the loop"
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> New assignment</button>}
      />
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search assignments…" />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input">
            <option value="">All classes</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <DataTable
          columns={[
            {
              key: 'title', header: 'Assignment',
              render: (a: Assignment) => (
                <button type="button" className="link text-left font-semibold" onClick={() => setViewing(a)}>
                  {a.title}
                  <span className="block text-xs font-normal text-slate-400">{classLabel(snap, a.classId, a.sectionId)} · {snap.subjects.find((s) => s.id === a.subjectId)?.name}</span>
                </button>
              ),
              sortValue: (a) => a.title,
            },
            { key: 'teacher', header: 'Teacher', render: (a: Assignment) => teacherName(snap.teachers.find((t) => t.id === a.teacherId)) },
            { key: 'due', header: 'Due', render: (a: Assignment) => <span className={a.dueDate < todayISO() && a.status === 'assigned' ? 'font-semibold text-red-600' : ''}>{fmt.date(a.dueDate)}</span>, sortValue: (a) => a.dueDate },
            {
              key: 'subs', header: 'Submissions',
              render: (a: Assignment) => {
                const s = summary(a);
                return <span className="text-xs">{s.done}/{s.total} in{s.late ? <span className="text-amber-600"> · {s.late} late</span> : null}</span>;
              },
            },
            { key: 'status', header: 'Status', render: (a: Assignment) => <StatusPill status={a.status} /> },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (a: Assignment) => (
                <div className="flex justify-end gap-1">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setViewing(a)}>Track</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: a })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(a)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(a) => a.id}
          emptyTitle="No assignments found"
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>New assignment</button>}
        />
      </Card>
      <AssignmentModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <TrackModal assignment={viewing ? (snap.assignments.find((a) => a.id === viewing.id) ?? viewing) : null} onClose={() => setViewing(null)} />
      <ConfirmDialog open={!!deleting} title={`Delete "${deleting?.title}"?`} message="The assignment and its submission tracking will be removed." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('assignments', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function AssignmentModal(props: { modal: { mode: 'add' | 'edit'; row?: Assignment } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    title: row?.title ?? '', description: row?.description ?? '', classId: row?.classId ?? '',
    sectionId: row?.sectionId ?? '', subjectId: row?.subjectId ?? '', teacherId: row?.teacherId ?? '',
    assignedDate: row?.assignedDate ?? todayISO(), dueDate: row?.dueDate ?? '',
    status: (row?.status ?? 'assigned') as AssignmentStatus, attachments: (row?.attachments ?? []).join(', '),
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.title)) e.title = 'Required';
    if (required(f.classId)) e.classId = 'Required';
    if (required(f.subjectId)) e.subjectId = 'Required';
    if (required(f.teacherId)) e.teacherId = 'Required';
    if (required(f.dueDate)) e.dueDate = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const attachments = f.attachments.split(',').map((s) => s.trim()).filter(Boolean);
    if (row) {
      update('assignments', row.id, {
        title: f.title.trim(), description: f.description.trim() || undefined, classId: f.classId,
        sectionId: f.sectionId || undefined, subjectId: f.subjectId, teacherId: f.teacherId,
        assignedDate: f.assignedDate, dueDate: f.dueDate, status: f.status, attachments,
      });
      toast.success('Assignment updated');
    } else {
      const pupils = studentsOfClass(snap, f.classId, f.sectionId || undefined);
      create('assignments', {
        title: f.title.trim(), description: f.description.trim() || undefined, classId: f.classId,
        sectionId: f.sectionId || undefined, subjectId: f.subjectId, teacherId: f.teacherId,
        assignedDate: f.assignedDate, dueDate: f.dueDate, status: f.status, attachments,
        submissions: pupils.map((p) => ({ studentId: p.id, status: 'pending' as SubmissionStatus })),
        createdAt: nowISO(),
      });
      toast.success(`Assignment created for ${pupils.length} students`);
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit assignment' : 'New assignment'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" error={errors.title} className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Fractions Worksheet — Ch.4" /></Field>
        <Field label="Description" optional className="sm:col-span-2"><textarea className="input" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Class" error={errors.classId}>
          <select className="input" value={f.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })}>
            <option value="">Select…</option>{snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Section" optional>
          <select className="input" value={f.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>
            <option value="">Whole class</option>{snap.sections.filter((s) => s.classId === f.classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Subject" error={errors.subjectId}>
          <select className="input" value={f.subjectId} onChange={(e) => {
            const cs = snap.classSubjects.find((x) => x.classId === f.classId && x.subjectId === e.target.value);
            set({ subjectId: e.target.value, teacherId: cs?.teacherId ?? f.teacherId });
          }}>
            <option value="">Select…</option>{snap.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Teacher" error={errors.teacherId}>
          <select className="input" value={f.teacherId} onChange={(e) => set({ teacherId: e.target.value })}>
            <option value="">Select…</option>{snap.teachers.map((t) => <option key={t.id} value={t.id}>{teacherName(t)}</option>)}
          </select>
        </Field>
        <Field label="Assigned date"><input type="date" className="input" value={f.assignedDate} onChange={(e) => set({ assignedDate: e.target.value })} /></Field>
        <Field label="Due date" error={errors.dueDate}><input type="date" className="input" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input capitalize" value={f.status} onChange={(e) => set({ status: e.target.value as AssignmentStatus })}>
            <option value="assigned">Assigned</option><option value="closed">Closed</option>
          </select>
        </Field>
        <Field label="Attachments" optional><input className="input" value={f.attachments} onChange={(e) => set({ attachments: e.target.value })} placeholder="file1.pdf, file2.pdf" /></Field>
      </div>
    </Modal>
  );
}

const SUB_STATUSES: SubmissionStatus[] = ['pending', 'submitted', 'late', 'graded'];

function TrackModal(props: { assignment: Assignment | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const update = useDB((s) => s.update);
  const fmt = useFmt();
  if (!props.assignment) return <></>;
  const a = props.assignment;

  const setSub = (studentId: string, patch: Partial<{ status: SubmissionStatus; grade: string; feedback: string }>): void => {
    const submissions = a.submissions.some((s) => s.studentId === studentId)
      ? a.submissions.map((s) => (s.studentId === studentId ? { ...s, ...patch, submittedAt: patch.status && patch.status !== 'pending' ? (s.submittedAt ?? todayISO()) : s.submittedAt } : s))
      : [...a.submissions, { studentId, status: patch.status ?? 'pending' as SubmissionStatus, submittedAt: todayISO(), grade: patch.grade, feedback: patch.feedback }];
    update('assignments', a.id, { submissions });
  };

  const pupils = studentsOfClass(snap, a.classId, a.sectionId || undefined, true);

  return (
    <Modal open onClose={props.onClose} title={a.title} subtitle={`${classLabel(snap, a.classId, a.sectionId)} · due ${fmt.date(a.dueDate)}`} size="xl"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Close</button></>}>
      {a.description ? <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{a.description}</p> : null}
      {a.attachments.length ? <p className="mb-3 text-xs text-slate-500">Attachments: {a.attachments.join(', ')}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Submitted</th><th className="px-3 py-2 text-left">Grade</th><th className="px-3 py-2 text-left">Feedback</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {pupils.map((p) => {
              const sub = a.submissions.find((s) => s.studentId === p.id);
              return (
                <tr key={p.id}>
                  <td className="table-cell"><Link to={`/students/${p.id}`} className="link">{studentName(p)}</Link></td>
                  <td className="table-cell">
                    <select className="input !w-auto !py-1 text-xs capitalize" value={sub?.status ?? 'pending'} onChange={(e) => setSub(p.id, { status: e.target.value as SubmissionStatus })}>
                      {SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="table-cell text-xs">{sub?.submittedAt ? fmt.date(sub.submittedAt) : '—'}</td>
                  <td className="table-cell">
                    <input className="input !w-20 !py-1 text-xs" value={sub?.grade ?? ''} onChange={(e) => setSub(p.id, { grade: e.target.value })} placeholder="A+" />
                  </td>
                  <td className="table-cell">
                    <input className="input !py-1 text-xs" value={sub?.feedback ?? ''} onChange={(e) => setSub(p.id, { feedback: e.target.value })} placeholder="Feedback…" />
                  </td>
                </tr>
              );
            })}
            {pupils.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">No students in scope.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Changes save automatically. Student self-submission can plug into this same structure later. <Badge tone="slate">Portal-ready</Badge></p>
    </Modal>
  );
}
