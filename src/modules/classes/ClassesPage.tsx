import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoveRight, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, studentName, studentsOfClass, teacherName } from '../../lib/db/selectors';
import type { ClassSubject, SchoolClass, Section, Student } from '../../lib/db/types';
import { required, hasErrors } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { cn, matchesQuery } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

type TabId = 'classes' | 'sections' | 'subjects' | 'enrollment';

export function ClassesPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const moveStudents = useDB((s) => s.moveStudents);
  const [tab, setTab] = useState<TabId>('classes');
  const [q, setQ] = useState('');
  const [classModal, setClassModal] = useState<{ mode: 'add' | 'edit'; row?: SchoolClass } | null>(null);
  const [sectionModal, setSectionModal] = useState<{ mode: 'add' | 'edit'; row?: Section } | null>(null);
  const [assignModal, setAssignModal] = useState<{ mode: 'add' | 'edit'; row?: ClassSubject } | null>(null);
  const [moveStudent, setMoveStudent] = useState<Student | null>(null);
  const [enrollClass, setEnrollClass] = useState('');
  const [enrollSection, setEnrollSection] = useState('');
  const [deleting, setDeleting] = useState<{ kind: string; id: string; label: string } | null>(null);

  const classes = useMemo(
    () => [...snap.classes].sort((a, b) => a.order - b.order).filter((c) => matchesQuery(q, c.name, c.code, c.room)),
    [snap, q],
  );
  const sections = useMemo(
    () => snap.sections.filter((s) => matchesQuery(q, s.name, classLabel(snap, s.classId))),
    [snap, q],
  );
  const enrolled = useMemo(
    () => studentsOfClass(snap, enrollClass || undefined, enrollSection || undefined, true),
    [snap, enrollClass, enrollSection],
  );

  const doDelete = (): void => {
    if (!deleting) return;
    if (deleting.kind === 'class') {
      const hasKids = snap.sections.some((s) => s.classId === deleting.id) || snap.students.some((s) => s.classId === deleting.id);
      if (hasKids) {
        toast.error('Cannot delete: move sections and students out first');
        setDeleting(null);
        return;
      }
      snap.classSubjects.filter((c) => c.classId === deleting.id).forEach((c) => remove('classSubjects', c.id));
    }
    if (deleting.kind === 'section') {
      if (snap.students.some((s) => s.sectionId === deleting.id)) {
        toast.error('Cannot delete: this section still has students');
        setDeleting(null);
        return;
      }
    }
    remove(deleting.kind === 'class' ? 'classes' : deleting.kind === 'section' ? 'sections' : 'classSubjects', deleting.id);
    toast.success('Deleted');
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="Classes & Sections"
        subtitle={`${snap.classes.length} classes · ${snap.sections.length} sections · ${snap.classSubjects.length} subject assignments`}
        actions={
          tab === 'classes' ? <button type="button" className="btn-primary" onClick={() => setClassModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add class</button>
          : tab === 'sections' ? <button type="button" className="btn-primary" onClick={() => setSectionModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add section</button>
          : tab === 'subjects' ? <button type="button" className="btn-primary" onClick={() => setAssignModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Assign subject</button>
          : undefined
        }
      />
      <Card>
        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs<TabId>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'classes', label: 'Classes', count: snap.classes.length },
              { id: 'sections', label: 'Sections', count: snap.sections.length },
              { id: 'subjects', label: 'Subject assignments', count: snap.classSubjects.length },
              { id: 'enrollment', label: 'Enrollment' },
            ]}
          />
          {tab !== 'enrollment' ? <SearchInput value={q} onChange={setQ} placeholder="Search…" className="sm:w-64" /> : null}
        </div>

        {tab === 'classes' ? (
          <DataTable
            columns={[
              { key: 'order', header: '#', render: (c: SchoolClass) => c.order, sortValue: (c) => c.order },
              { key: 'name', header: 'Class', render: (c: SchoolClass) => <span className="font-semibold">{c.name} <span className="text-xs font-normal text-slate-400">{c.code}</span></span>, sortValue: (c) => c.name },
              { key: 'room', header: 'Room', render: (c: SchoolClass) => c.room ?? '—' },
              { key: 'teacher', header: 'Class teacher', render: (c: SchoolClass) => teacherName(snap.teachers.find((t) => t.id === c.classTeacherId)) },
              {
                key: 'students', header: 'Students',
                render: (c: SchoolClass) => {
                  const n = studentsOfClass(snap, c.id).length;
                  return <span>{n}{c.capacity ? <span className="text-xs text-slate-400"> / {c.capacity}</span> : null}</span>;
                },
                sortValue: (c) => studentsOfClass(snap, c.id).length,
              },
              { key: 'sections', header: 'Sections', render: (c: SchoolClass) => <span className="flex flex-wrap gap-1">{snap.sections.filter((s) => s.classId === c.id).map((s) => <Badge key={s.id} tone="blue">{s.name}</Badge>)}</span> },
              {
                key: 'actions', header: 'Actions', className: 'text-right',
                render: (c: SchoolClass) => (
                  <div className="flex justify-end gap-1">
                    <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setClassModal({ mode: 'edit', row: c })}>Edit</button>
                    <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting({ kind: 'class', id: c.id, label: c.name })}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ),
              },
            ]}
            data={classes}
            keyOf={(c) => c.id}
            emptyTitle="No classes yet"
            emptyAction={<button type="button" className="btn-primary" onClick={() => setClassModal({ mode: 'add' })}>Add class</button>}
          />
        ) : null}

        {tab === 'sections' ? (
          <DataTable
            columns={[
              { key: 'class', header: 'Class', render: (s: Section) => classLabel(snap, s.classId), sortValue: (s) => classLabel(snap, s.classId) },
              { key: 'name', header: 'Section', render: (s: Section) => <span className="font-semibold">{s.name}</span>, sortValue: (s) => s.name },
              { key: 'teacher', header: 'Class teacher', render: (s: Section) => teacherName(snap.teachers.find((t) => t.id === s.classTeacherId)) },
              { key: 'students', header: 'Students', render: (s: Section) => studentsOfClass(snap, s.classId, s.id).length, sortValue: (s) => studentsOfClass(snap, s.classId, s.id).length },
              { key: 'capacity', header: 'Capacity', render: (s: Section) => s.capacity ?? '—' },
              {
                key: 'actions', header: 'Actions', className: 'text-right',
                render: (s: Section) => (
                  <div className="flex justify-end gap-1">
                    <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setSectionModal({ mode: 'edit', row: s })}>Edit</button>
                    <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting({ kind: 'section', id: s.id, label: s.name })}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ),
              },
            ]}
            data={sections}
            keyOf={(s) => s.id}
            emptyTitle="No sections yet"
          />
        ) : null}

        {tab === 'subjects' ? (
          <DataTable
            columns={[
              { key: 'class', header: 'Class', render: (r: ClassSubject) => classLabel(snap, r.classId, r.sectionId), sortValue: (r) => classLabel(snap, r.classId, r.sectionId) },
              { key: 'subject', header: 'Subject', render: (r: ClassSubject) => snap.subjects.find((s) => s.id === r.subjectId)?.name ?? '—', sortValue: (r) => snap.subjects.find((s) => s.id === r.subjectId)?.name ?? '' },
              { key: 'teacher', header: 'Teacher', render: (r: ClassSubject) => teacherName(snap.teachers.find((t) => t.id === r.teacherId)) },
              { key: 'periods', header: 'Periods/wk', render: (r: ClassSubject) => r.weeklyPeriods ?? '—' },
              {
                key: 'actions', header: 'Actions', className: 'text-right',
                render: (r: ClassSubject) => (
                  <div className="flex justify-end gap-1">
                    <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setAssignModal({ mode: 'edit', row: r })}>Edit</button>
                    <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting({ kind: 'assign', id: r.id, label: 'assignment' })}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ),
              },
            ]}
            data={snap.classSubjects}
            keyOf={(r) => r.id}
            pageSize={12}
            emptyTitle="No subject assignments"
          />
        ) : null}

        {tab === 'enrollment' ? (
          <div>
            <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3">
              <select value={enrollClass} onChange={(e) => { setEnrollClass(e.target.value); setEnrollSection(''); }} className="input">
                <option value="">All classes</option>
                {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={enrollSection} onChange={(e) => setEnrollSection(e.target.value)} className="input">
                <option value="">All sections</option>
                {snap.sections.filter((s) => !enrollClass || s.classId === enrollClass).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="self-center text-sm text-slate-500">{enrolled.length} students</p>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Student', render: (s: Student) => <Link to={`/students/${s.id}`} className="link">{studentName(s)}</Link>, sortValue: (s) => studentName(s) },
                { key: 'id', header: 'Student ID', render: (s: Student) => s.studentId },
                { key: 'class', header: 'Class', render: (s: Student) => classLabel(snap, s.classId, s.sectionId) },
                { key: 'roll', header: 'Roll', render: (s: Student) => s.rollNo ?? '—' },
                {
                  key: 'move', header: 'Move', className: 'text-right',
                  render: (s: Student) => <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setMoveStudent(s)}><MoveRight className="h-3.5 w-3.5" /> Move</button>,
                },
              ]}
              data={enrolled}
              keyOf={(s) => s.id}
              emptyTitle="No students in this scope"
            />
          </div>
        ) : null}
      </Card>

      <ClassModal key={classModal ? `${classModal.mode}-${classModal.row?.id ?? "new"}` : "closed"} modal={classModal} onClose={() => setClassModal(null)} />
      <SectionModal key={sectionModal ? `${sectionModal.mode}-${sectionModal.row?.id ?? "new"}` : "closed"} modal={sectionModal} onClose={() => setSectionModal(null)} />
      <AssignModal key={assignModal ? `${assignModal.mode}-${assignModal.row?.id ?? "new"}` : "closed"} modal={assignModal} onClose={() => setAssignModal(null)} />
      <MoveModal
        key={moveStudent?.id ?? 'closed'}
        student={moveStudent}
        onClose={() => setMoveStudent(null)}
        onMove={(classId, sectionId) => {
          if (moveStudent) {
            moveStudents([moveStudent.id], classId, sectionId);
            toast.success(`Moved to ${classLabel(snap, classId, sectionId)}`);
          }
          setMoveStudent(null);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.label}?`}
        message="This removes the record. Linked students must be moved elsewhere first."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/* --------------------------------- modals ---------------------------------- */

function ClassModal(props: { modal: { mode: 'add' | 'edit'; row?: SchoolClass } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({ name: row?.name ?? '', code: row?.code ?? '', room: row?.room ?? '', capacity: row?.capacity?.toString() ?? '', classTeacherId: row?.classTeacherId ?? '', order: row?.order?.toString() ?? String(snap.classes.length + 1) });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.name)) e.name = 'Required';
    if (required(f.code)) e.code = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      name: f.name.trim(), code: f.code.trim().toUpperCase(), room: f.room.trim() || undefined,
      capacity: f.capacity ? Number(f.capacity) : undefined, classTeacherId: f.classTeacherId || undefined,
      order: Number(f.order) || 0,
      academicYearId: row?.academicYearId ?? snap.academicYears.find((y) => y.isCurrent)?.id ?? '',
    };
    if (row) {
      update('classes', row.id, payload);
      toast.success('Class updated');
    } else {
      create('classes', payload);
      toast.success('Class created');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit class' : 'Add class'} footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Class name" error={errors.name}><input className={cn('input', errors.name && 'input-error')} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Grade 1" /></Field>
        <Field label="Code" error={errors.code}><input className="input" value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="G1" /></Field>
        <Field label="Room" optional><input className="input" value={f.room} onChange={(e) => set({ room: e.target.value })} placeholder="R-101" /></Field>
        <Field label="Capacity" optional><input type="number" min={0} className="input" value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} /></Field>
        <Field label="Class teacher" optional>
          <select className="input" value={f.classTeacherId} onChange={(e) => set({ classTeacherId: e.target.value })}>
            <option value="">—</option>
            {snap.teachers.map((t) => <option key={t.id} value={t.id}>{teacherName(t)}</option>)}
          </select>
        </Field>
        <Field label="Sort order"><input type="number" className="input" value={f.order} onChange={(e) => set({ order: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function SectionModal(props: { modal: { mode: 'add' | 'edit'; row?: Section } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({ classId: row?.classId ?? '', name: row?.name ?? '', capacity: row?.capacity?.toString() ?? '', classTeacherId: row?.classTeacherId ?? '' });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.classId)) e.classId = 'Required';
    if (required(f.name)) e.name = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = { classId: f.classId, name: f.name.trim(), capacity: f.capacity ? Number(f.capacity) : undefined, classTeacherId: f.classTeacherId || undefined };
    if (row) {
      update('sections', row.id, payload);
      toast.success('Section updated');
    } else {
      create('sections', payload);
      toast.success('Section created');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit section' : 'Add section'} footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Class" error={errors.classId}>
          <select className={cn('input', errors.classId && 'input-error')} value={f.classId} onChange={(e) => set({ classId: e.target.value })}>
            <option value="">Select…</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Section name" error={errors.name}><input className={cn('input', errors.name && 'input-error')} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Section A" /></Field>
        <Field label="Capacity" optional><input type="number" min={0} className="input" value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} /></Field>
        <Field label="Class teacher" optional>
          <select className="input" value={f.classTeacherId} onChange={(e) => set({ classTeacherId: e.target.value })}>
            <option value="">—</option>
            {snap.teachers.map((t) => <option key={t.id} value={t.id}>{teacherName(t)}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function AssignModal(props: { modal: { mode: 'add' | 'edit'; row?: ClassSubject } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({ classId: row?.classId ?? '', sectionId: row?.sectionId ?? '', subjectId: row?.subjectId ?? '', teacherId: row?.teacherId ?? '', weeklyPeriods: row?.weeklyPeriods?.toString() ?? '3' });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.classId)) e.classId = 'Required';
    if (required(f.subjectId)) e.subjectId = 'Required';
    const dup = snap.classSubjects.find((x) => x.id !== row?.id && x.classId === f.classId && (x.sectionId ?? '') === f.sectionId && x.subjectId === f.subjectId);
    if (dup) e.subjectId = 'This subject is already assigned here';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = { classId: f.classId, sectionId: f.sectionId || undefined, subjectId: f.subjectId, teacherId: f.teacherId || undefined, weeklyPeriods: Number(f.weeklyPeriods) || 0 };
    if (row) {
      update('classSubjects', row.id, payload);
      toast.success('Assignment updated');
    } else {
      create('classSubjects', payload);
      toast.success('Subject assigned');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit assignment' : 'Assign subject'} footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Class" error={errors.classId}>
          <select className="input" value={f.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })}>
            <option value="">Select…</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Section" optional>
          <select className="input" value={f.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>
            <option value="">Whole class</option>
            {snap.sections.filter((s) => s.classId === f.classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Subject" error={errors.subjectId}>
          <select className="input" value={f.subjectId} onChange={(e) => set({ subjectId: e.target.value })}>
            <option value="">Select…</option>
            {snap.subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </Field>
        <Field label="Teacher" optional>
          <select className="input" value={f.teacherId} onChange={(e) => set({ teacherId: e.target.value })}>
            <option value="">—</option>
            {snap.teachers.map((t) => <option key={t.id} value={t.id}>{teacherName(t)}</option>)}
          </select>
        </Field>
        <Field label="Periods / week"><input type="number" min={0} max={20} className="input" value={f.weeklyPeriods} onChange={(e) => set({ weeklyPeriods: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function MoveModal(props: { student: Student | null; onClose: () => void; onMove: (classId: string, sectionId?: string) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const [classId, setClassId] = useState(props.student?.classId ?? '');
  const [sectionId, setSectionId] = useState(props.student?.sectionId ?? '');
  if (!props.student) return <></>;
  return (
    <Modal open onClose={props.onClose} title={`Move ${studentName(props.student)}`} subtitle={`Currently: ${classLabel(snap, props.student.classId, props.student.sectionId)}`} footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" disabled={!classId} onClick={() => props.onMove(classId, sectionId || undefined)}>Move</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Class">
          <select className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Section" optional>
          <select className="input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">—</option>
            {snap.sections.filter((s) => s.classId === classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
