import { useMemo, useState } from 'react';
import { ExternalLink, FileText, Link2, PlayCircle, Presentation, StickyNote, Plus, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel } from '../../lib/db/selectors';
import type { MaterialKind, StudyMaterial } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { matchesQuery, nowISO } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const KINDS: { id: MaterialKind; label: string; icon: LucideIcon }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'presentation', label: 'Presentation', icon: Presentation },
  { id: 'video', label: 'Video', icon: PlayCircle },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'notes', label: 'Notes', icon: StickyNote },
];

export function StudyMaterialsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [kind, setKind] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: StudyMaterial } | null>(null);
  const [deleting, setDeleting] = useState<StudyMaterial | null>(null);

  const filtered = useMemo(
    () => [...snap.materials].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((m) => (!classId || m.classId === classId) && (!kind || m.kind === kind) && matchesQuery(q, m.title, m.description, m.fileName)),
    [snap, q, classId, kind],
  );

  return (
    <div>
      <PageHeader
        title="Study materials"
        subtitle="Resource library organised by class and subject"
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add resource</button>}
      />
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search resources…" />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input">
            <option value="">All classes</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="input">
            <option value="">All kinds</option>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>
        <DataTable
          columns={[
            {
              key: 'title', header: 'Resource',
              render: (m: StudyMaterial) => {
                const K = KINDS.find((k) => k.id === m.kind)?.icon ?? FileText;
                return (
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[var(--brand-primary)]"><K className="h-4 w-4" /></span>
                    <span><span className="block font-semibold">{m.title}</span><span className="block max-w-72 truncate text-xs text-slate-400">{m.description ?? m.fileName ?? m.url ?? ''}</span></span>
                  </span>
                );
              },
              sortValue: (m) => m.title,
            },
            { key: 'kind', header: 'Type', render: (m: StudyMaterial) => <Badge tone="blue">{KINDS.find((k) => k.id === m.kind)?.label}</Badge> },
            { key: 'scope', header: 'Class / Subject', render: (m: StudyMaterial) => <span className="text-xs">{m.classId ? classLabel(snap, m.classId, m.sectionId) : 'Whole school'}{m.subjectId ? ` · ${snap.subjects.find((s) => s.id === m.subjectId)?.name}` : ''}</span> },
            { key: 'by', header: 'Shared by', render: (m: StudyMaterial) => <span className="text-xs">{m.uploadedBy ?? '—'}<span className="block text-slate-400">{fmt.date(m.createdAt.slice(0, 10))}</span></span> },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (m: StudyMaterial) => (
                <div className="flex justify-end gap-1">
                  {m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1 text-xs"><ExternalLink className="h-3.5 w-3.5" /></a> : null}
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: m })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(m)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(m) => m.id}
          emptyTitle="No resources yet"
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>Add resource</button>}
        />
      </Card>
      <MaterialModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <ConfirmDialog open={!!deleting} title={`Delete "${deleting?.title}"?`} message="The resource will be removed from the library." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('materials', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function MaterialModal(props: { modal: { mode: 'add' | 'edit'; row?: StudyMaterial } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    title: row?.title ?? '', description: row?.description ?? '', kind: (row?.kind ?? 'pdf') as MaterialKind,
    url: row?.url ?? '', fileName: row?.fileName ?? '', classId: row?.classId ?? '', sectionId: row?.sectionId ?? '',
    subjectId: row?.subjectId ?? '', uploadedBy: row?.uploadedBy ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.title)) e.title = 'Required';
    if ((f.kind === 'link' || f.kind === 'video') && required(f.url)) e.url = 'URL required for this type';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      title: f.title.trim(), description: f.description.trim() || undefined, kind: f.kind,
      url: f.url.trim() || undefined, fileName: f.fileName.trim() || undefined,
      classId: f.classId || undefined, sectionId: f.sectionId || undefined, subjectId: f.subjectId || undefined,
      academicYearId: row?.academicYearId ?? snap.academicYears.find((y) => y.isCurrent)?.id ?? '',
      uploadedBy: f.uploadedBy.trim() || undefined,
    };
    if (row) {
      update('materials', row.id, payload);
      toast.success('Resource updated');
    } else {
      create('materials', { ...payload, createdAt: nowISO() });
      toast.success('Resource added');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit resource' : 'Add resource'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" error={errors.title} className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Type">
          <select className="input" value={f.kind} onChange={(e) => set({ kind: e.target.value as MaterialKind })}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Field>
        <Field label="Shared by" optional><input className="input" value={f.uploadedBy} onChange={(e) => set({ uploadedBy: e.target.value })} placeholder="Teacher name" /></Field>
        {(f.kind === 'link' || f.kind === 'video') ? (
          <Field label="URL" error={errors.url} className="sm:col-span-2"><input className="input" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" /></Field>
        ) : (
          <Field label="File name" optional className="sm:col-span-2"><input className="input" value={f.fileName} onChange={(e) => set({ fileName: e.target.value })} placeholder="chapter-4-notes.pdf" /></Field>
        )}
        <Field label="Description" optional className="sm:col-span-2"><textarea className="input" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Class" optional>
          <select className="input" value={f.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })}>
            <option value="">Whole school</option>{snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Section" optional>
          <select className="input" value={f.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>
            <option value="">All sections</option>{snap.sections.filter((s) => s.classId === f.classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Subject" optional className="sm:col-span-2">
          <select className="input" value={f.subjectId} onChange={(e) => set({ subjectId: e.target.value })}>
            <option value="">All subjects</option>{snap.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
