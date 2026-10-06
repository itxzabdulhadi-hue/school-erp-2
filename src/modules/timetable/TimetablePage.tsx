import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Printer } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, detectTimetableConflicts, teacherName } from '../../lib/db/selectors';
import type { TimetableSlot } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { Card, ConfirmDialog, Field, Modal, PageHeader, Tabs } from '../../components/ui/primitives';
import { toast } from '../../components/ui/toast';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TimetablePage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const navigate = useNavigate();
  const [view, setView] = useState<'class' | 'teacher'>('class');
  const [classId, setClassId] = useState(snap.classes[0]?.id ?? '');
  const [sectionId, setSectionId] = useState('');
  const [teacherId, setTeacherId] = useState(snap.teachers[0]?.id ?? '');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: TimetableSlot } | null>(null);
  const [deleting, setDeleting] = useState<TimetableSlot | null>(null);

  const slots = useMemo(() => {
    const list = view === 'class'
      ? snap.timetable.filter((t) => t.classId === classId && (!sectionId || (t.sectionId ?? '') === sectionId))
      : snap.timetable.filter((t) => t.teacherId === teacherId);
    return [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [snap, view, classId, sectionId, teacherId]);

  const times = useMemo(() => {
    const set = new Map<string, { start: string; end: string }>();
    slots.forEach((s) => set.set(`${s.startTime}-${s.endTime}`, { start: s.startTime, end: s.endTime }));
    return [...set.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [slots]);

  const cell = (day: number, start: string, end: string): TimetableSlot[] =>
    slots.filter((s) => s.day === day && s.startTime === start && s.endTime === end);

  const subjectName = (id: string): string => snap.subjects.find((s) => s.id === id)?.name ?? '—';

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle="Weekly schedules with automatic conflict detection"
        actions={
          <>
            <button
              type="button" className="btn-secondary"
              onClick={() => navigate(view === 'class' ? `/print/timetable?class=${classId}&section=${sectionId}` : `/print/timetable?teacher=${teacherId}`)}
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add period</button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
          <Tabs<'class' | 'teacher'> active={view} onChange={setView} tabs={[{ id: 'class', label: 'Class view' }, { id: 'teacher', label: 'Teacher view' }]} />
          <div className="flex gap-2 lg:ml-auto">
            {view === 'class' ? (
              <>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }} className="input">
                  {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="input">
                  <option value="">All sections</option>
                  {snap.sections.filter((s) => s.classId === classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </>
            ) : (
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="input">
                {snap.teachers.map((t) => <option key={t.id} value={t.id}>{teacherName(t)}</option>)}
              </select>
            )}
          </div>
        </div>
        {slots.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No periods scheduled for this {view === 'class' ? 'class' : 'teacher'} yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="table-head">
                  <th className="px-3 py-2.5 text-left">Time</th>
                  {DAYS.map((d) => <th key={d} className="px-3 py-2.5 text-left">{d}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {times.map((t) => (
                  <tr key={`${t.start}-${t.end}`}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-500">
                      {fmt.time(t.start)}<br />{fmt.time(t.end)}
                    </td>
                    {[1, 2, 3, 4, 5, 6].map((day, di) => (
                      <td key={DAYS[di]} className="px-2 py-1.5 align-top">
                        <div className="space-y-1.5">
                          {cell(day, t.start, t.end).map((s) => (
                            <div key={s.id} className="group rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                              <p className="font-bold text-slate-800">{subjectName(s.subjectId)}</p>
                              <p className="text-slate-500">{view === 'class' ? teacherName(snap.teachers.find((x) => x.id === s.teacherId)) : classLabel(snap, s.classId, s.sectionId)}</p>
                              {s.room ? <p className="text-slate-400">Room {s.room}</p> : null}
                              <div className="mt-1 hidden gap-1 group-hover:flex">
                                <button type="button" className="link" onClick={() => setModal({ mode: 'edit', row: s })}>Edit</button>
                                <button type="button" className="text-red-600 hover:underline" onClick={() => setDeleting(s)}>Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <SlotModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} defaults={{ classId, sectionId, teacherId, view }} onClose={() => setModal(null)} />
      <ConfirmDialog
        open={!!deleting} title="Delete period?" message="This removes the period from the timetable." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('timetable', deleting.id); toast.success('Period deleted'); setDeleting(null); }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function SlotModal(props: {
  modal: { mode: 'add' | 'edit'; row?: TimetableSlot } | null;
  defaults: { classId: string; sectionId: string; teacherId: string; view: 'class' | 'teacher' };
  onClose: () => void;
}): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const d = props.defaults;
  const [f, setF] = useState({
    classId: row?.classId ?? d.classId, sectionId: row?.sectionId ?? (d.view === 'class' ? d.sectionId : ''),
    day: String(row?.day ?? 1), subjectId: row?.subjectId ?? '', teacherId: row?.teacherId ?? (d.view === 'teacher' ? d.teacherId : ''),
    room: row?.room ?? '', startTime: row?.startTime ?? '08:00', endTime: row?.endTime ?? '08:45',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [conflicts, setConflicts] = useState<string[]>([]);
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => {
    setF((x) => ({ ...x, ...p }));
    setConflicts([]);
  };

  const save = (): void => {
    const e: Errors = {};
    if (required(f.classId)) e.classId = 'Required';
    if (required(f.subjectId)) e.subjectId = 'Required';
    if (required(f.teacherId)) e.teacherId = 'Required';
    if (f.startTime >= f.endTime) e.endTime = 'End must be after start';
    setErrors(e);
    if (hasErrors(e)) return;
    const candidate = {
      classId: f.classId, sectionId: f.sectionId || undefined, day: Number(f.day),
      subjectId: f.subjectId, teacherId: f.teacherId, room: f.room.trim() || undefined,
      startTime: f.startTime, endTime: f.endTime,
      academicYearId: row?.academicYearId ?? snap.academicYears.find((y) => y.isCurrent)?.id ?? '',
    };
    const issues = detectTimetableConflicts(snap, row ? { ...candidate, id: row.id } : candidate);
    if (issues.length) {
      setConflicts(issues);
      return;
    }
    if (row) {
      update('timetable', row.id, candidate);
      toast.success('Period updated');
    } else {
      create('timetable', candidate);
      toast.success('Period added');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit period' : 'Add period'}
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      {conflicts.length > 0 ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <p className="font-bold">Scheduling conflict — not saved:</p>
          <ul className="mt-1 list-disc pl-4">{conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Class" error={errors.classId}>
          <select className="input" value={f.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })}>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Section" optional>
          <select className="input" value={f.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>
            <option value="">Whole class</option>
            {snap.sections.filter((s) => s.classId === f.classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Day">
          <select className="input" value={f.day} onChange={(e) => set({ day: e.target.value })}>
            {DAYS.map((d2, i) => <option key={d2} value={i + 1}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}</option>)}
          </select>
        </Field>
        <Field label="Subject" error={errors.subjectId}>
          <select className="input" value={f.subjectId} onChange={(e) => set({ subjectId: e.target.value })}>
            <option value="">Select…</option>
            {snap.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Teacher" error={errors.teacherId}>
          <select className="input" value={f.teacherId} onChange={(e) => set({ teacherId: e.target.value })}>
            <option value="">Select…</option>
            {snap.teachers.map((t) => <option key={t.id} value={t.id}>{teacherName(t)}</option>)}
          </select>
        </Field>
        <Field label="Room" optional><input className="input" value={f.room} onChange={(e) => set({ room: e.target.value })} placeholder="R-101" /></Field>
        <Field label="Start time"><input type="time" className="input" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} /></Field>
        <Field label="End time" error={errors.endTime}><input type="time" className="input" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
