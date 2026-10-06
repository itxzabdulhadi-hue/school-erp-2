import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import type { Subject, SubjectType } from '../../lib/db/types';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { cn, matchesQuery } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const TYPES: { id: SubjectType; label: string; tone: 'blue' | 'purple' | 'cyan' | 'amber' }[] = [
  { id: 'core', label: 'Core', tone: 'blue' },
  { id: 'elective', label: 'Elective', tone: 'purple' },
  { id: 'practical', label: 'Practical', tone: 'cyan' },
  { id: 'activity', label: 'Activity', tone: 'amber' },
];

export function SubjectsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: Subject } | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const filtered = useMemo(
    () => snap.subjects.filter((s) => (!typeFilter || s.type === typeFilter) && matchesQuery(q, s.name, s.code, s.description)),
    [snap, q, typeFilter],
  );

  const doDelete = (): void => {
    if (!deleting) return;
    const used = snap.classSubjects.some((c) => c.subjectId === deleting.id) || snap.timetable.some((t) => t.subjectId === deleting.id);
    if (used) {
      toast.error('Cannot delete: subject is assigned to classes or timetable');
      setDeleting(null);
      return;
    }
    remove('subjects', deleting.id);
    toast.success('Subject deleted');
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="Subjects"
        subtitle={`${snap.subjects.length} subjects across the curriculum`}
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add subject</button>}
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row">
          <SearchInput value={q} onChange={setQ} placeholder="Search subjects…" className="sm:w-72" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input sm:w-48">
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <DataTable
          columns={[
            { key: 'code', header: 'Code', render: (s: Subject) => <span className="font-mono text-xs font-bold">{s.code}</span>, sortValue: (s) => s.code },
            { key: 'name', header: 'Subject', render: (s: Subject) => <span className="font-semibold">{s.name}</span>, sortValue: (s) => s.name },
            { key: 'type', header: 'Type', render: (s: Subject) => <Badge tone={TYPES.find((t) => t.id === s.type)?.tone ?? 'slate'}>{TYPES.find((t) => t.id === s.type)?.label ?? s.type}</Badge> },
            { key: 'credits', header: 'Credits/hrs', render: (s: Subject) => s.creditHours ?? '—' },
            { key: 'classes', header: 'Classes', render: (s: Subject) => new Set(snap.classSubjects.filter((c) => c.subjectId === s.id).map((c) => c.classId)).size },
            { key: 'teachers', header: 'Teachers', render: (s: Subject) => snap.teachers.filter((t) => t.subjectIds.includes(s.id)).length },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (s: Subject) => (
                <div className="flex justify-end gap-1">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: s })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(s)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(s) => s.id}
          emptyTitle="No subjects found"
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>Add subject</button>}
        />
      </Card>
      <SubjectModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} message="The subject will be removed from the curriculum." confirmLabel="Delete" onConfirm={doDelete} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function SubjectModal(props: { modal: { mode: 'add' | 'edit'; row?: Subject } | null; onClose: () => void }): React.JSX.Element {
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const snap = useDB((s) => s);
  const row = props.modal?.row;
  const [f, setF] = useState({ name: row?.name ?? '', code: row?.code ?? '', type: row?.type ?? 'core', creditHours: row?.creditHours?.toString() ?? '', description: row?.description ?? '' });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.name)) e.name = 'Required';
    if (required(f.code)) e.code = 'Required';
    const dup = snap.subjects.find((s) => s.id !== row?.id && (s.code.toLowerCase() === f.code.trim().toLowerCase() || s.name.toLowerCase() === f.name.trim().toLowerCase()));
    if (dup) e.code = `Duplicate of ${dup.name}`;
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = { name: f.name.trim(), code: f.code.trim().toUpperCase(), type: f.type as SubjectType, creditHours: f.creditHours ? Number(f.creditHours) : undefined, description: f.description.trim() || undefined };
    if (row) {
      update('subjects', row.id, payload);
      toast.success('Subject updated');
    } else {
      create('subjects', payload);
      toast.success('Subject created');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit subject' : 'Add subject'} footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Subject name" error={errors.name}><input className={cn('input', errors.name && 'input-error')} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Mathematics" /></Field>
        <Field label="Subject code" error={errors.code}><input className={cn('input', errors.code && 'input-error')} value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="MATH" /></Field>
        <Field label="Type">
          <select className="input" value={f.type} onChange={(e) => set({ type: e.target.value as SubjectType })}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Credit hours" optional><input type="number" min={0} className="input" value={f.creditHours} onChange={(e) => set({ creditHours: e.target.value })} /></Field>
        <Field label="Description" optional className="sm:col-span-2"><textarea className="input" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
