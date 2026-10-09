import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Download, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, examResults, studentName, studentsOfClass } from '../../lib/db/selectors';
import { gradeFor } from '../../lib/grading';
import type { Exam, ExamSchedule, ExamStatus, ExamType } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { addDaysISO, cn, exportCSV, matchesQuery } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatusPill, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

type TabId = 'exams' | 'schedules' | 'marks';

const EXAM_TYPES: { id: ExamType; label: string }[] = [
  { id: 'midterm', label: 'Midterm' }, { id: 'final', label: 'Final' }, { id: 'monthly', label: 'Monthly test' },
  { id: 'quiz', label: 'Quiz' }, { id: 'practical', label: 'Practical' }, { id: 'other', label: 'Other' },
];
const EXAM_STATUSES: ExamStatus[] = ['scheduled', 'ongoing', 'completed', 'cancelled'];

export function ExamsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const [tab, setTab] = useState<TabId>('exams');
  const [examModal, setExamModal] = useState<{ mode: 'add' | 'edit'; row?: Exam } | null>(null);
  const [deleting, setDeleting] = useState<Exam | null>(null);

  const doDelete = (): void => {
    if (!deleting) return;
    snap.examSchedules.filter((s) => s.examId === deleting.id).forEach((s) => remove('examSchedules', s.id));
    snap.marks.filter((m) => m.examId === deleting.id).forEach((m) => remove('marks', m.id));
    remove('exams', deleting.id);
    toast.success('Exam, date sheet and marks deleted');
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="Exams & Marks"
        subtitle="Examinations, date sheets and marks entry"
        actions={tab === 'exams' ? <button type="button" className="btn-primary" onClick={() => setExamModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Create exam</button> : undefined}
      />
      <Card>
        <div className="p-3">
          <Tabs<TabId>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'exams', label: 'Examinations', count: snap.exams.length },
              { id: 'schedules', label: 'Date sheets', count: snap.examSchedules.length },
              { id: 'marks', label: 'Marks entry' },
            ]}
          />
        </div>
        {tab === 'exams' ? <ExamsTab onEdit={(row) => setExamModal({ mode: 'edit', row })} onDelete={setDeleting} /> : null}
        {tab === 'schedules' ? <SchedulesTab /> : null}
        {tab === 'marks' ? <MarksTab /> : null}
      </Card>
      <ExamModal key={examModal ? `${examModal.mode}-${examModal.row?.id ?? "new"}` : "closed"} modal={examModal} onClose={() => setExamModal(null)} />
      <ConfirmDialog
        open={!!deleting} title={`Delete ${deleting?.name}?`}
        message="The exam, its full date sheet and all entered marks will be permanently removed."
        confirmLabel="Delete all" onConfirm={doDelete} onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/* --------------------------------- exams tab -------------------------------- */

function ExamsTab(props: { onEdit: (row: Exam) => void; onDelete: (row: Exam) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => [...snap.exams].sort((a, b) => b.startDate.localeCompare(a.startDate)).filter((e) => matchesQuery(q, e.name, e.term)), [snap, q]);
  return (
    <div>
      <div className="border-b border-slate-100 p-3"><SearchInput value={q} onChange={setQ} placeholder="Search exams…" className="sm:w-72" /></div>
      <DataTable
        columns={[
          { key: 'name', header: 'Examination', render: (e: Exam) => <span className="font-semibold">{e.name}<span className="block text-xs font-normal text-slate-400">{e.term} · {EXAM_TYPES.find((t) => t.id === e.type)?.label}</span></span>, sortValue: (e) => e.name },
          { key: 'dates', header: 'Schedule', render: (e: Exam) => <span className="text-xs">{fmt.date(e.startDate)} → {fmt.date(e.endDate)}</span>, sortValue: (e) => e.startDate },
          { key: 'papers', header: 'Papers', render: (e: Exam) => snap.examSchedules.filter((s) => s.examId === e.id).length },
          {
            key: 'entry', header: 'Marks entry',
            render: (e: Exam) => {
              const n = snap.marks.filter((m) => m.examId === e.id).length;
              return n ? <Badge tone="green">{n} entered</Badge> : <Badge tone="slate">Pending</Badge>;
            },
          },
          { key: 'status', header: 'Status', render: (e: Exam) => <StatusPill status={e.status} /> },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (e: Exam) => (
              <div className="flex justify-end gap-1">
                <Link to={`/results?exam=${e.id}`} className="btn-ghost !px-2 !py-1 text-xs">Results</Link>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => props.onEdit(e)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => props.onDelete(e)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={filtered}
        keyOf={(e) => e.id}
        emptyTitle="No examinations yet"
      />
    </div>
  );
}

function ExamModal(props: { modal: { mode: 'add' | 'edit'; row?: Exam } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const school = useDB((s) => s.school);
  const row = props.modal?.row;
  const [f, setF] = useState({
    name: row?.name ?? '', term: row?.term ?? school.currentTerm, type: (row?.type ?? 'monthly') as ExamType,
    startDate: row?.startDate ?? '', endDate: row?.endDate ?? '', status: (row?.status ?? 'scheduled') as ExamStatus,
    description: row?.description ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.name)) e.name = 'Required';
    if (required(f.startDate)) e.startDate = 'Required';
    if (required(f.endDate)) e.endDate = 'Required';
    if (f.startDate && f.endDate && f.endDate < f.startDate) e.endDate = 'Ends before it starts';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      name: f.name.trim(), term: f.term.trim(), type: f.type,
      academicYearId: row?.academicYearId ?? snap.academicYears.find((y) => y.isCurrent)?.id ?? '',
      startDate: f.startDate, endDate: f.endDate, status: f.status, description: f.description.trim() || undefined,
    };
    if (row) {
      update('exams', row.id, payload);
      toast.success('Exam updated');
    } else {
      create('exams', { ...payload, createdAt: new Date().toISOString() });
      toast.success('Exam created — now build its date sheet');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit exam' : 'Create exam'}
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Exam name" error={errors.name} className="sm:col-span-2"><input className={cn('input', errors.name && 'input-error')} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Final Examination" /></Field>
        <Field label="Term"><input className="input" value={f.term} onChange={(e) => set({ term: e.target.value })} /></Field>
        <Field label="Type">
          <select className="input" value={f.type} onChange={(e) => set({ type: e.target.value as ExamType })}>
            {EXAM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Start date" error={errors.startDate}><input type="date" className="input" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
        <Field label="End date" error={errors.endDate}><input type="date" className="input" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input capitalize" value={f.status} onChange={(e) => set({ status: e.target.value as ExamStatus })}>
            {EXAM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Description" optional className="sm:col-span-2"><textarea className="input" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* -------------------------------- schedules --------------------------------- */

function SchedulesTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const [examId, setExamId] = useState(snap.exams[0]?.id ?? '');
  const [classId, setClassId] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: ExamSchedule } | null>(null);
  const [deleting, setDeleting] = useState<ExamSchedule | null>(null);

  const rows = useMemo(
    () => snap.examSchedules.filter((s) => (!examId || s.examId === examId) && (!classId || s.classId === classId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [snap, examId, classId],
  );

  const autoGenerate = (): void => {
    const exam = snap.exams.find((e) => e.id === examId);
    if (!exam) {
      toast.error('Select an exam first');
      return;
    }
    let created = 0;
    snap.classes.forEach((c) => {
      const subs = snap.classSubjects.filter((cs) => cs.classId === c.id);
      subs.forEach((cs, si) => {
        const exists = snap.examSchedules.some((s) => s.examId === examId && s.classId === c.id && s.subjectId === cs.subjectId);
        if (exists) return;
        create('examSchedules', {
          examId, classId: c.id, subjectId: cs.subjectId,
          date: addDaysISO(exam.startDate, si),
          startTime: '09:00', endTime: '12:00', room: c.room, maxMarks: 100, passingMarks: 40,
        });
        created++;
      });
    });
    toast.success(created ? `Generated ${created} papers` : 'Date sheet already complete');
  };

  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-4">
        <select value={examId} onChange={(e) => setExamId(e.target.value)} className="input">
          <option value="">All exams</option>
          {snap.exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input">
          <option value="">All classes</option>
          {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" className="btn-secondary" onClick={autoGenerate}><CalendarPlus className="h-4 w-4" /> Auto-generate</button>
        <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add paper</button>
      </div>
      <DataTable
        columns={[
          { key: 'exam', header: 'Exam', render: (s: ExamSchedule) => snap.exams.find((e) => e.id === s.examId)?.name ?? '—' },
          { key: 'class', header: 'Class', render: (s: ExamSchedule) => classLabel(snap, s.classId), sortValue: (s) => classLabel(snap, s.classId) },
          { key: 'subject', header: 'Subject', render: (s: ExamSchedule) => snap.subjects.find((x) => x.id === s.subjectId)?.name ?? '—' },
          { key: 'date', header: 'Date', render: (s: ExamSchedule) => fmt.date(s.date), sortValue: (s) => s.date },
          { key: 'time', header: 'Time', render: (s: ExamSchedule) => <span className="text-xs">{fmt.time(s.startTime)} – {fmt.time(s.endTime)}</span> },
          { key: 'room', header: 'Room', render: (s: ExamSchedule) => s.room ?? '—' },
          { key: 'max', header: 'Max / Pass', render: (s: ExamSchedule) => <span className="text-xs">{s.maxMarks} / {s.passingMarks}</span> },
          {
            key: 'entered', header: 'Marks',
            render: (s: ExamSchedule) => {
              const n = snap.marks.filter((m) => m.scheduleId === s.id).length;
              const total = studentsOfClass(snap, s.classId).length;
              return n >= total && total > 0 ? <Badge tone="green">Complete</Badge> : n ? <Badge tone="amber">{n}/{total}</Badge> : <Badge tone="slate">Pending</Badge>;
            },
          },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (s: ExamSchedule) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: s })}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(s)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={rows}
        keyOf={(s) => s.id}
        pageSize={12}
        emptyTitle="No papers scheduled"
      />
      <ScheduleModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} presetExam={examId} onClose={() => setModal(null)} />
      <ConfirmDialog
        open={!!deleting} title="Delete paper?" message="Entered marks for this paper will also be removed." confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) {
            snap.marks.filter((m) => m.scheduleId === deleting.id).forEach((m) => remove('marks', m.id));
            remove('examSchedules', deleting.id);
            toast.success('Paper deleted');
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function ScheduleModal(props: { modal: { mode: 'add' | 'edit'; row?: ExamSchedule } | null; presetExam: string; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    examId: row?.examId ?? props.presetExam ?? '', classId: row?.classId ?? '', subjectId: row?.subjectId ?? '',
    date: row?.date ?? '', startTime: row?.startTime ?? '09:00', endTime: row?.endTime ?? '12:00',
    room: row?.room ?? '', maxMarks: String(row?.maxMarks ?? 100), passingMarks: String(row?.passingMarks ?? 40),
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.examId)) e.examId = 'Required';
    if (required(f.classId)) e.classId = 'Required';
    if (required(f.subjectId)) e.subjectId = 'Required';
    if (required(f.date)) e.date = 'Required';
    if (Number(f.passingMarks) > Number(f.maxMarks)) e.passingMarks = 'Pass marks exceed max';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      examId: f.examId, classId: f.classId, subjectId: f.subjectId, date: f.date,
      startTime: f.startTime, endTime: f.endTime, room: f.room.trim() || undefined,
      maxMarks: Number(f.maxMarks) || 100, passingMarks: Number(f.passingMarks) || 0,
    };
    if (row) {
      update('examSchedules', row.id, payload);
      toast.success('Paper updated');
    } else {
      create('examSchedules', payload);
      toast.success('Paper scheduled');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit paper' : 'Schedule paper'}
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Exam" error={errors.examId}>
          <select className="input" value={f.examId} onChange={(e) => set({ examId: e.target.value })}>
            <option value="">Select…</option>{snap.exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="Class" error={errors.classId}>
          <select className="input" value={f.classId} onChange={(e) => set({ classId: e.target.value })}>
            <option value="">Select…</option>{snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Subject" error={errors.subjectId}>
          <select className="input" value={f.subjectId} onChange={(e) => set({ subjectId: e.target.value })}>
            <option value="">Select…</option>{snap.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Date" error={errors.date}><input type="date" className="input" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Start"><input type="time" className="input" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} /></Field>
        <Field label="End"><input type="time" className="input" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></Field>
        <Field label="Room" optional><input className="input" value={f.room} onChange={(e) => set({ room: e.target.value })} /></Field>
        <Field label="Max marks"><input type="number" min={1} className="input" value={f.maxMarks} onChange={(e) => set({ maxMarks: e.target.value })} /></Field>
        <Field label="Passing marks" error={errors.passingMarks}><input type="number" min={0} className="input" value={f.passingMarks} onChange={(e) => set({ passingMarks: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* --------------------------------- marks entry ------------------------------ */

function MarksTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const saveMarks = useDB((s) => s.saveMarks);
  const [examId, setExamId] = useState(snap.exams[0]?.id ?? '');
  const [classId, setClassId] = useState(snap.classes[0]?.id ?? '');
  const [scheduleId, setScheduleId] = useState('');
  const [draft, setDraft] = useState<Record<string, { marks: string; absent: boolean }>>({});

  const schedules = useMemo(() => snap.examSchedules.filter((s) => s.examId === examId && (!classId || s.classId === classId)), [snap, examId, classId]);
  const schedule = schedules.find((s) => s.id === (scheduleId || schedules[0]?.id)) ?? schedules[0];
  const pupils = useMemo(() => (schedule ? studentsOfClass(snap, schedule.classId) : []), [snap, schedule]);

  const existing = useMemo(() => {
    const map: Record<string, { marks: string; absent: boolean }> = {};
    if (!schedule) return map;
    snap.marks.forEach((m) => {
      if (m.scheduleId === schedule.id) map[m.studentId] = { marks: String(m.obtainedMarks), absent: !!m.isAbsent };
    });
    return map;
  }, [snap, schedule]);

  const val = (id: string): { marks: string; absent: boolean } => draft[id] ?? existing[id] ?? { marks: '', absent: false };

  const save = (): void => {
    if (!schedule) return;
    const list = pupils
      .filter((p) => {
        const v = val(p.id);
        return v.absent || v.marks.trim() !== '';
      })
      .map((p) => {
        const v = val(p.id);
        const obtained = v.absent ? 0 : Math.max(0, Math.min(schedule.maxMarks, Number(v.marks) || 0));
        return { examId: schedule.examId, scheduleId: schedule.id, studentId: p.id, subjectId: schedule.subjectId, obtainedMarks: obtained, maxMarks: schedule.maxMarks, isAbsent: v.absent || undefined };
      });
    saveMarks(list);
    setDraft({});
    toast.success(`Saved marks for ${list.length} students`);
  };

  const stats = useMemo(() => {
    const nums = pupils.map((p) => val(p.id)).filter((v) => !v.absent && v.marks.trim() !== '').map((v) => Number(v.marks) || 0);
    if (!nums.length) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return { avg: Math.round(avg * 10) / 10, max: Math.max(...nums), min: Math.min(...nums), pass: nums.filter((n) => schedule && n >= schedule.passingMarks).length, n: nums.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pupils, draft, existing, schedule]);

  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-4">
        <select value={examId} onChange={(e) => { setExamId(e.target.value); setDraft({}); }} className="input">
          {snap.exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setScheduleId(''); setDraft({}); }} className="input">
          <option value="">All classes</option>
          {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={schedule?.id ?? ''} onChange={(e) => { setScheduleId(e.target.value); setDraft({}); }} className="input">
          {schedules.map((s) => <option key={s.id} value={s.id}>{snap.subjects.find((x) => x.id === s.subjectId)?.name} — {classLabel(snap, s.classId)}</option>)}
        </select>
        <div className="flex gap-2">
          <button
            type="button" className="btn-secondary flex-1"
            disabled={!schedule}
            onClick={() => {
              if (!schedule || !examId) return;
              const rows = examResults(snap, examId, schedule.classId);
              exportCSV(`marks-${schedule.id}`, ['Student', 'ID', 'Marks', 'Max', 'Grade'],
                rows.map((r) => {
                  const cell = r.subjects.find((x) => x.subjectId === schedule.subjectId);
                  const g = cell ? gradeFor(cell.absent ? 0 : (cell.obtained / cell.max) * 100, snap.gradeScales) : null;
                  return [studentName(r.student), r.student.studentId, cell?.absent ? 'AB' : cell?.obtained ?? '', schedule.maxMarks, g?.grade ?? ''];
                }));
              toast.success('Marks exported');
            }}
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button type="button" className="btn-primary flex-1" disabled={!schedule} onClick={save}>Save marks</button>
        </div>
      </div>
      {schedule ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
          <span>Max <b>{schedule.maxMarks}</b> · Pass <b>{schedule.passingMarks}</b></span>
          {stats ? <span className="ml-auto">Avg <b>{stats.avg}</b> · Highest <b>{stats.max}</b> · Lowest <b>{stats.min}</b> · Passed <b>{stats.pass}/{stats.n}</b></span> : <span className="ml-auto text-slate-400">Enter marks to see live stats</span>}
        </div>
      ) : null}
      {!schedule ? <p className="px-5 py-10 text-center text-sm text-slate-400">No papers for this selection — add one in the Date sheets tab.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-head"><th className="px-4 py-2.5 text-left">Student</th><th className="px-4 py-2.5 text-left">Marks / {schedule.maxMarks}</th><th className="px-4 py-2.5 text-left">Absent</th><th className="px-4 py-2.5 text-left">Grade</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pupils.map((p) => {
                const v = val(p.id);
                const num = v.absent ? 0 : Number(v.marks) || 0;
                const g = gradeFor((num / schedule.maxMarks) * 100, snap.gradeScales, (schedule.passingMarks / schedule.maxMarks) * 100);
                const over = !v.absent && v.marks.trim() !== '' && num > schedule.maxMarks;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="table-cell"><span className="font-medium">{studentName(p)}</span><span className="block text-xs text-slate-400">{p.studentId}</span></td>
                    <td className="table-cell">
                      <input
                        type="number" min={0} max={schedule.maxMarks} disabled={v.absent}
                        className={cn('input !w-32', over && 'input-error')}
                        value={v.marks}
                        onChange={(e) => setDraft((d) => ({ ...d, [p.id]: { marks: e.target.value, absent: false } }))}
                      />
                      {over ? <span className="ml-2 text-xs text-red-600">Max {schedule.maxMarks}</span> : null}
                    </td>
                    <td className="table-cell">
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={v.absent} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: { marks: '', absent: e.target.checked } }))} className="h-4 w-4 accent-[var(--brand-primary)]" />
                        Absent
                      </label>
                    </td>
                    <td className="table-cell">
                      {v.absent ? <Badge tone="red">AB</Badge> : v.marks.trim() === '' ? <span className="text-slate-300">—</span> : <Badge tone={g.passed ? 'green' : 'red'}>{g.grade}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
