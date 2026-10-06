import { useMemo, useState } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel } from '../../lib/db/selectors';
import type { Announcement, AnnouncementCategory, Priority } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { cn, matchesQuery, nowISO, todayISO } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput } from '../../components/ui/primitives';
import { toast } from '../../components/ui/toast';

const CATEGORIES: AnnouncementCategory[] = ['general', 'academic', 'examination', 'fees', 'event', 'emergency'];
const PRIORITIES: { id: Priority; tone: 'slate' | 'blue' | 'amber' | 'red' }[] = [
  { id: 'low', tone: 'slate' }, { id: 'normal', tone: 'blue' }, { id: 'high', tone: 'amber' }, { id: 'urgent', tone: 'red' },
];

export function AnnouncementsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const push = useDB((s) => s.pushNotification);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: Announcement } | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  const filtered = useMemo(
    () => [...snap.announcements]
      .sort((a, b) => b.publishDate.localeCompare(a.publishDate))
      .filter((a) => (!cat || a.category === cat) && matchesQuery(q, a.title, a.body)),
    [snap, q, cat],
  );

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Broadcasts for students, parents and staff"
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> New announcement</button>}
      />
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search announcements…" />
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input capitalize">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <ul className="divide-y divide-slate-100">
          {filtered.map((a) => {
            const expired = a.expiryDate && a.expiryDate < todayISO();
            return (
              <li key={a.id} className={cn('flex gap-3 px-4 py-4 sm:px-5', expired && 'opacity-60')}>
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', a.priority === 'urgent' ? 'bg-red-100 text-red-700' : a.priority === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-[var(--brand-primary)]')}>
                  <Megaphone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{a.title}</p>
                    <Badge tone={PRIORITIES.find((p) => p.id === a.priority)?.tone ?? 'slate'}>{a.priority}</Badge>
                    <Badge tone="slate">{a.category}</Badge>
                    {expired ? <Badge tone="red">Expired</Badge> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{a.body}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Published {fmt.date(a.publishDate)}{a.expiryDate ? ` · Expires ${fmt.date(a.expiryDate)}` : ''}
                    {a.targetClassId ? ` · Target: ${classLabel(snap, a.targetClassId, a.targetSectionId)}` : ' · Whole school'}
                    {a.attachment ? ` · 📎 ${a.attachment}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: a })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(a)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 ? <li className="px-5 py-10 text-center text-sm text-slate-400">No announcements found.</li> : null}
        </ul>
      </Card>
      <AnnouncementModal
        key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'}
        modal={modal} onClose={() => setModal(null)}
        onPublished={(a) => push({ type: 'announcement', title: a.title, body: a.body.slice(0, 140), relatedId: a.id })}
      />
      <ConfirmDialog open={!!deleting} title="Delete announcement?" message="It will no longer appear on the dashboard." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('announcements', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function AnnouncementModal(props: { modal: { mode: 'add' | 'edit'; row?: Announcement } | null; onClose: () => void; onPublished: (a: Announcement) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    title: row?.title ?? '', body: row?.body ?? '', category: (row?.category ?? 'general') as AnnouncementCategory,
    priority: (row?.priority ?? 'normal') as Priority, publishDate: row?.publishDate ?? todayISO(),
    expiryDate: row?.expiryDate ?? '', targetClassId: row?.targetClassId ?? '', targetSectionId: row?.targetSectionId ?? '',
    attachment: row?.attachment ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.title)) e.title = 'Required';
    if (required(f.body)) e.body = 'Required';
    if (required(f.publishDate)) e.publishDate = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      title: f.title.trim(), body: f.body.trim(), category: f.category, priority: f.priority,
      publishDate: f.publishDate, expiryDate: f.expiryDate || undefined,
      targetClassId: f.targetClassId || undefined, targetSectionId: f.targetSectionId || undefined,
      attachment: f.attachment.trim() || undefined,
    };
    if (row) {
      update('announcements', row.id, payload);
      toast.success('Announcement updated');
    } else {
      const id = create('announcements', { ...payload, createdAt: nowISO() });
      props.onPublished({ ...payload, id, createdAt: nowISO() });
      toast.success('Announcement published');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit announcement' : 'New announcement'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>{row ? 'Save' : 'Publish'}</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" error={errors.title} className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Message" error={errors.body} className="sm:col-span-2"><textarea className="input" rows={4} value={f.body} onChange={(e) => set({ body: e.target.value })} /></Field>
        <Field label="Category">
          <select className="input capitalize" value={f.category} onChange={(e) => set({ category: e.target.value as AnnouncementCategory })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="input capitalize" value={f.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
          </select>
        </Field>
        <Field label="Publish date" error={errors.publishDate}><input type="date" className="input" value={f.publishDate} onChange={(e) => set({ publishDate: e.target.value })} /></Field>
        <Field label="Expiry date" optional><input type="date" className="input" value={f.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} /></Field>
        <Field label="Target class" optional>
          <select className="input" value={f.targetClassId} onChange={(e) => set({ targetClassId: e.target.value, targetSectionId: '' })}>
            <option value="">Whole school</option>{snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Target section" optional>
          <select className="input" value={f.targetSectionId} onChange={(e) => set({ targetSectionId: e.target.value })}>
            <option value="">All sections</option>{snap.sections.filter((s) => s.classId === f.targetClassId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Attachment" optional className="sm:col-span-2"><input className="input" value={f.attachment} onChange={(e) => set({ attachment: e.target.value })} placeholder="notice.pdf" /></Field>
      </div>
    </Modal>
  );
}
