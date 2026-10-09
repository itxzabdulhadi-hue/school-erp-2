import { useMemo, useState } from 'react';
import { FileArchive, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { staffName, studentName, teacherName } from '../../lib/db/selectors';
import type { DocEntityType, DocRecord } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { matchesQuery, nowISO } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const ENTITIES: { id: DocEntityType; label: string }[] = [
  { id: 'student', label: 'Student' }, { id: 'teacher', label: 'Teacher' }, { id: 'staff', label: 'Staff' },
  { id: 'class', label: 'Class' }, { id: 'school', label: 'School' },
];
const KINDS = ['Identity', 'Academic', 'Qualification', 'Employment', 'Legal', 'Compliance', 'Policy', 'Medical', 'Other'];

export function DocumentsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: DocRecord } | null>(null);
  const [deleting, setDeleting] = useState<DocRecord | null>(null);

  const entityLabel = (d: DocRecord): string => {
    if (d.entityType === 'student') return studentName(snap.students.find((s) => s.id === d.entityId));
    if (d.entityType === 'teacher') return teacherName(snap.teachers.find((s) => s.id === d.entityId));
    if (d.entityType === 'staff') return staffName(snap.staff.find((s) => s.id === d.entityId));
    if (d.entityType === 'class') return snap.classes.find((s) => s.id === d.entityId)?.name ?? '—';
    return 'Whole school';
  };

  const filtered = useMemo(
    () => [...snap.documents].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .filter((d) => (!entity || d.entityType === entity) && matchesQuery(q, d.name, d.kind, d.fileName, d.description)),
    [snap, q, entity],
  );

  return (
    <div>
      <PageHeader title="Documents" subtitle="Central repository linked to people, classes and the school" actions={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add document</button>} />
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search documents…" />
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="input">
            <option value="">All owners</option>{ENTITIES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <DataTable
          columns={[
            {
              key: 'name', header: 'Document',
              render: (d: DocRecord) => (
                <span className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><FileArchive className="h-4 w-4" /></span>
                  <span><span className="block font-semibold">{d.name}</span><span className="block text-xs text-slate-400">{d.fileName ?? 'metadata record'}{d.fileSize ? ` · ${d.fileSize}` : ''}</span></span>
                </span>
              ),
              sortValue: (d) => d.name,
            },
            { key: 'kind', header: 'Type', render: (d: DocRecord) => <Badge tone="slate">{d.kind}</Badge> },
            { key: 'owner', header: 'Linked to', render: (d: DocRecord) => <span className="text-xs">{ENTITIES.find((e) => e.id === d.entityType)?.label}: {entityLabel(d)}</span> },
            { key: 'date', header: 'Uploaded', render: (d: DocRecord) => fmt.date(d.uploadedAt.slice(0, 10)), sortValue: (d) => d.uploadedAt },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (d: DocRecord) => (
                <div className="flex justify-end gap-1">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: d })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(d)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(d) => d.id}
          emptyTitle="No documents yet"
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>Add document</button>}
        />
      </Card>
      <DocModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <ConfirmDialog open={!!deleting} title={`Delete "${deleting?.name}"?`} message="The document record will be removed." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('documents', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function DocModal(props: { modal: { mode: 'add' | 'edit'; row?: DocRecord } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    name: row?.name ?? '', kind: row?.kind ?? 'Other', entityType: (row?.entityType ?? 'student') as DocEntityType,
    entityId: row?.entityId ?? '', fileName: row?.fileName ?? '', fileSize: row?.fileSize ?? '', description: row?.description ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const options = f.entityType === 'student'
    ? snap.students.map((s) => ({ id: s.id, label: studentName(s) }))
    : f.entityType === 'teacher'
      ? snap.teachers.map((s) => ({ id: s.id, label: teacherName(s) }))
      : f.entityType === 'staff'
        ? snap.staff.map((s) => ({ id: s.id, label: staffName(s) }))
        : f.entityType === 'class'
          ? snap.classes.map((s) => ({ id: s.id, label: s.name }))
          : [];

  const save = (): void => {
    const e: Errors = {};
    if (required(f.name)) e.name = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      name: f.name.trim(), kind: f.kind, entityType: f.entityType, entityId: f.entityType === 'school' ? undefined : f.entityId || undefined,
      fileName: f.fileName.trim() || undefined, fileSize: f.fileSize.trim() || undefined, description: f.description.trim() || undefined,
    };
    if (row) {
      update('documents', row.id, payload);
      toast.success('Document updated');
    } else {
      create('documents', { ...payload, uploadedAt: nowISO() });
      toast.success('Document added');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit document' : 'Add document'}
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Document name" error={errors.name} className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Birth Certificate — Ali Khan" /></Field>
        <Field label="Type">
          <select className="input" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Linked to">
          <select className="input" value={f.entityType} onChange={(e) => set({ entityType: e.target.value as DocEntityType, entityId: '' })}>
            {ENTITIES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        {f.entityType !== 'school' ? (
          <Field label="Record" optional className="sm:col-span-2">
            <select className="input" value={f.entityId} onChange={(e) => set({ entityId: e.target.value })}>
              <option value="">—</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="File name" optional><input className="input" value={f.fileName} onChange={(e) => set({ fileName: e.target.value })} placeholder="birth-cert.pdf" /></Field>
        <Field label="File size" optional><input className="input" value={f.fileSize} onChange={(e) => set({ fileSize: e.target.value })} placeholder="1.2 MB" /></Field>
        <Field label="Description" optional className="sm:col-span-2"><textarea className="input" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">Binary file storage (S3 / local vault) can replace these metadata records without changing the UI.</p>
    </Modal>
  );
}
