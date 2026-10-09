import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, studentName } from '../../lib/db/selectors';
import type { DisciplineRecord } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { matchesQuery, nowISO, todayISO } from '../../lib/utils';
import { Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatusPill } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const INCIDENTS = ['Late Arrival', 'Uniform Violation', 'Classroom Disruption', 'Unexplained Absence', 'Homework Default', 'Library Book Damage', 'Playground Misconduct', 'Bullying Concern', 'Exam Misconduct', 'Other'];

export function DisciplinePage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: DisciplineRecord } | null>(null);
  const [deleting, setDeleting] = useState<DisciplineRecord | null>(null);

  const filtered = useMemo(
    () => [...snap.discipline].sort((a, b) => b.date.localeCompare(a.date))
      .filter((d) => (!severity || d.severity === severity) && matchesQuery(q, studentName(snap.students.find((s) => s.id === d.studentId)), d.incidentType, d.description)),
    [snap, q, severity],
  );

  return (
    <div>
      <PageHeader
        title="Discipline records"
        subtitle="Factual, supportive notes focused on student growth"
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> New record</button>}
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {(['minor', 'moderate', 'serious'] as const).map((s) => (
          <div key={s} className="card flex items-center gap-3 p-4">
            <ShieldAlert className={`h-5 w-5 ${s === 'serious' ? 'text-red-500' : s === 'moderate' ? 'text-amber-500' : 'text-slate-400'}`} />
            <div><p className="text-xl font-bold capitalize">{snap.discipline.filter((d) => d.severity === s).length}</p><p className="text-xs capitalize text-slate-500">{s}</p></div>
          </div>
        ))}
      </div>
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
          <SearchInput value={q} onChange={setQ} placeholder="Student, incident…" />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input capitalize">
            <option value="">All severities</option>
            <option value="minor">Minor</option><option value="moderate">Moderate</option><option value="serious">Serious</option>
          </select>
        </div>
        <DataTable
          columns={[
            { key: 'date', header: 'Date', render: (d: DisciplineRecord) => fmt.date(d.date), sortValue: (d) => d.date },
            {
              key: 'student', header: 'Student',
              render: (d: DisciplineRecord) => {
                const s = snap.students.find((x) => x.id === d.studentId);
                return s ? <Link to={`/students/${s.id}`} className="link">{studentName(s)}<span className="block text-xs font-normal text-slate-400">{classLabel(snap, s.classId, s.sectionId)}</span></Link> : '—';
              },
            },
            { key: 'type', header: 'Incident', render: (d: DisciplineRecord) => <span className="font-medium">{d.incidentType}</span> },
            { key: 'desc', header: 'Details', render: (d: DisciplineRecord) => <span className="block max-w-72 truncate text-xs text-slate-500" title={d.description}>{d.description}</span> },
            { key: 'severity', header: 'Severity', render: (d: DisciplineRecord) => <StatusPill status={d.severity} /> },
            { key: 'action', header: 'Action taken', render: (d: DisciplineRecord) => <span className="text-xs">{d.actionTaken ?? '—'}</span> },
            { key: 'follow', header: 'Follow-up', render: (d: DisciplineRecord) => (d.followUpDate ? fmt.date(d.followUpDate) : '—') },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (d: DisciplineRecord) => (
                <div className="flex justify-end gap-1">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: d })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(d)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(d) => d.id}
          emptyTitle="No discipline records"
          emptyHint="A clean slate. Records added here stay factual and supportive."
        />
      </Card>
      <RecordModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <ConfirmDialog open={!!deleting} title="Delete record?" message="The discipline record will be removed." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('discipline', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function RecordModal(props: { modal: { mode: 'add' | 'edit'; row?: DisciplineRecord } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    studentId: row?.studentId ?? '', date: row?.date ?? todayISO(), incidentType: row?.incidentType ?? 'Late Arrival',
    description: row?.description ?? '', severity: (row?.severity ?? 'minor') as DisciplineRecord['severity'],
    actionTaken: row?.actionTaken ?? '', notes: row?.notes ?? '', followUpDate: row?.followUpDate ?? '', reportedBy: row?.reportedBy ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.studentId)) e.studentId = 'Required';
    if (required(f.date)) e.date = 'Required';
    if (required(f.description)) e.description = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      studentId: f.studentId, date: f.date, incidentType: f.incidentType, description: f.description.trim(),
      severity: f.severity, actionTaken: f.actionTaken.trim() || undefined, notes: f.notes.trim() || undefined,
      followUpDate: f.followUpDate || undefined, reportedBy: f.reportedBy.trim() || undefined,
    };
    if (row) {
      update('discipline', row.id, payload);
      toast.success('Record updated');
    } else {
      create('discipline', { ...payload, createdAt: nowISO() });
      toast.success('Record added');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit record' : 'New discipline record'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Student" error={errors.studentId}>
          <select className="input" value={f.studentId} onChange={(e) => set({ studentId: e.target.value })}>
            <option value="">Select…</option>
            {snap.students.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{studentName(s)} — {classLabel(snap, s.classId, s.sectionId)}</option>)}
          </select>
        </Field>
        <Field label="Date" error={errors.date}><input type="date" className="input" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Incident type">
          <select className="input" value={f.incidentType} onChange={(e) => set({ incidentType: e.target.value })}>
            {INCIDENTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <select className="input capitalize" value={f.severity} onChange={(e) => set({ severity: e.target.value as DisciplineRecord['severity'] })}>
            <option value="minor">Minor</option><option value="moderate">Moderate</option><option value="serious">Serious</option>
          </select>
        </Field>
        <Field label="Description" error={errors.description} className="sm:col-span-2"><textarea className="input" rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Factual, non-judgmental description…" /></Field>
        <Field label="Action taken" optional><input className="input" value={f.actionTaken} onChange={(e) => set({ actionTaken: e.target.value })} placeholder="Counselling / guardian meeting / …" /></Field>
        <Field label="Reported by" optional><input className="input" value={f.reportedBy} onChange={(e) => set({ reportedBy: e.target.value })} placeholder="Class Teacher" /></Field>
        <Field label="Follow-up date" optional><input type="date" className="input" value={f.followUpDate} onChange={(e) => set({ followUpDate: e.target.value })} /></Field>
        <Field label="Notes" optional><input className="input" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
