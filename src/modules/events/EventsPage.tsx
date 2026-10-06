import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import type { SchoolEvent } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { cn, matchesQuery, nowISO, todayISO } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, Tabs } from '../../components/ui/primitives';
import { toast } from '../../components/ui/toast';

const EVENT_CATS = ['Meeting', 'Sports', 'Academic', 'Cultural', 'Competition', 'Workshop', 'Holiday', 'Health', 'Other'];

export function EventsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const push = useDB((s) => s.pushNotification);
  const fmt = useFmt();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [scope, setScope] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: SchoolEvent } | null>(null);
  const [deleting, setDeleting] = useState<SchoolEvent | null>(null);

  const filtered = useMemo(
    () => [...snap.events]
      .sort((a, b) => scope === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
      .filter((e) =>
        (scope === 'all' || (scope === 'upcoming' ? e.date >= todayISO() : e.date < todayISO())) &&
        (!cat || e.category === cat) && matchesQuery(q, e.title, e.description, e.location),
      ),
    [snap, q, cat, scope],
  );

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const out: (string | null)[] = [];
    for (let i = 0; i < new Date(y, m - 1, 1).getDay(); i++) out.push(null);
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) out.push(`${month}-${String(d).padStart(2, '0')}`);
    return out;
  }, [month]);

  const shiftMonth = (dir: number): void => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="School calendar, functions and holidays"
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> New event</button>}
      />
      <Card>
        <div className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
          <Tabs<'list' | 'calendar'> active={view} onChange={setView} tabs={[{ id: 'list', label: 'List' }, { id: 'calendar', label: 'Calendar' }]} />
          <div className="grid flex-1 gap-2 sm:grid-cols-3 lg:max-w-2xl lg:ml-auto">
            <SearchInput value={q} onChange={setQ} placeholder="Search events…" />
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
              <option value="">All categories</option>{EVENT_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="input">
              <option value="upcoming">Upcoming</option><option value="past">Past</option><option value="all">All</option>
            </select>
          </div>
        </div>

        {view === 'list' ? (
          <ul className="divide-y divide-slate-100">
            {filtered.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]">
                  <span className="text-lg font-extrabold leading-none">{e.date.slice(8)}</span>
                  <span className="text-[10px] font-bold uppercase">{new Date(`${e.date}T12:00:00`).toLocaleString('en', { month: 'short' })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{e.title}</p>
                    <Badge tone="blue">{e.category}</Badge>
                    {e.date < todayISO() ? <Badge tone="slate">Past</Badge> : null}
                  </div>
                  {e.description ? <p className="mt-0.5 text-sm text-slate-600">{e.description}</p> : null}
                  <p className="mt-1 text-xs text-slate-400">
                    {fmt.date(e.date)}{e.startTime ? ` · ${fmt.time(e.startTime)}${e.endTime ? `–${fmt.time(e.endTime)}` : ''}` : ''}
                    {e.location ? ` · ${e.location}` : ''}{e.organizer ? ` · by ${e.organizer}` : ''}{e.audience ? ` · for ${e.audience}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: e })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(e)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
            {filtered.length === 0 ? <li className="px-5 py-10 text-center text-sm text-slate-400">No events match these filters.</li> : null}
          </ul>
        ) : (
          <div className="p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" className="btn-secondary !px-2" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></button>
              <p className="text-sm font-bold">{new Date(`${month}-02T12:00:00`).toLocaleString('en', { month: 'long', year: 'numeric' })}</p>
              <button type="button" className="btn-secondary !px-2" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d} className="py-1">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                const dayEvents = day ? snap.events.filter((e) => e.date === day && (!cat || e.category === cat)) : [];
                return (
                  <div key={i} className={cn('min-h-20 rounded-lg border p-1 sm:min-h-24', day ? 'border-slate-200 bg-white' : 'border-transparent', day === todayISO() && 'border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]')}>
                    {day ? (
                      <>
                        <p className={cn('px-1 text-xs font-bold', day === todayISO() ? 'text-[var(--brand-primary)]' : 'text-slate-500')}>{Number(day.slice(8))}</p>
                        <div className="mt-0.5 space-y-0.5">
                          {dayEvents.slice(0, 3).map((e) => (
                            <button key={e.id} type="button" onClick={() => setModal({ mode: 'edit', row: e })} className="block w-full truncate rounded bg-[var(--brand-primary-light)] px-1 py-0.5 text-left text-[10px] font-medium text-[var(--brand-primary-dark)] hover:underline">
                              {e.title}
                            </button>
                          ))}
                          {dayEvents.length > 3 ? <span className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3} more</span> : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
      <EventModal
        key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'}
        modal={modal} onClose={() => setModal(null)}
        onSaved={(title, date) => push({ type: 'event', title: `Event: ${title}`, body: `Scheduled for ${date}` })}
      />
      <ConfirmDialog open={!!deleting} title={`Delete "${deleting?.title}"?`} message="The event will be removed from the calendar." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('events', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function EventModal(props: { modal: { mode: 'add' | 'edit'; row?: SchoolEvent } | null; onClose: () => void; onSaved: (title: string, date: string) => void }): React.JSX.Element {
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    title: row?.title ?? '', description: row?.description ?? '', date: row?.date ?? todayISO(),
    startTime: row?.startTime ?? '', endTime: row?.endTime ?? '', location: row?.location ?? '',
    category: row?.category ?? 'Meeting', organizer: row?.organizer ?? '', audience: row?.audience ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.title)) e.title = 'Required';
    if (required(f.date)) e.date = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      title: f.title.trim(), description: f.description.trim() || undefined, date: f.date,
      startTime: f.startTime || undefined, endTime: f.endTime || undefined, location: f.location.trim() || undefined,
      category: f.category, organizer: f.organizer.trim() || undefined, audience: f.audience.trim() || undefined,
    };
    if (row) {
      update('events', row.id, payload);
      toast.success('Event updated');
    } else {
      create('events', { ...payload, createdAt: nowISO() });
      props.onSaved(payload.title, payload.date);
      toast.success('Event scheduled');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit event' : 'New event'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" error={errors.title} className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Description" optional className="sm:col-span-2"><textarea className="input" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Date" error={errors.date}><input type="date" className="input" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Location" optional><input className="input" value={f.location} onChange={(e) => set({ location: e.target.value })} placeholder="Main Hall" /></Field>
        <Field label="Start time" optional><input type="time" className="input" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} /></Field>
        <Field label="End time" optional><input type="time" className="input" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => set({ category: e.target.value })}>
            {EVENT_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Audience" optional><input className="input" value={f.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Whole school / Parents / Grades 5–10" /></Field>
        <Field label="Organizer" optional className="sm:col-span-2"><input className="input" value={f.organizer} onChange={(e) => set({ organizer: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
