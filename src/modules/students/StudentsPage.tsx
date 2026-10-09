import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Download, GraduationCap, Plus, Printer, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import {
  classLabel, nextAdmissionNo, nextStudentId, studentName, studentOutstanding,
} from '../../lib/db/selectors';
import type { Gender, Guardian, Student, StudentStatus } from '../../lib/db/types';
import { useFmt, useMoney, useSchool } from '../../lib/useSchool';
import { hasErrors, isEmail, isPhone, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { cn, exportCSV, matchesQuery, nowISO, todayISO } from '../../lib/utils';
import {
  Avatar, Badge, Card, ConfirmDialog, EmptyState, Field, Modal, PageHeader,
  SearchInput, StatusPill,
} from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const STATUSES: StudentStatus[] = ['active', 'inactive', 'graduated', 'transferred', 'withdrawn'];

interface GuardianDraft {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  occupation: string;
  isEmergency: boolean;
}

interface FormState {
  studentId: string; admissionNo: string;
  firstName: string; middleName: string; lastName: string;
  gender: Gender; dob: string; bloodGroup: string; nationality: string; religion: string;
  phone: string; email: string; address: string; city: string; previousSchool: string;
  admissionDate: string; classId: string; sectionId: string; rollNo: string; status: StudentStatus;
  routeId: string; pickupPoint: string; dropPoint: string; notes: string;
  guardians: GuardianDraft[];
}

const blankGuardian = (): GuardianDraft => ({ name: '', relationship: '', phone: '', email: '', occupation: '', isEmergency: false });

export function StudentsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const moveStudents = useDB((s) => s.moveStudents);
  const money = useMoney();
  const fmt = useFmt();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; student?: Student } | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  // Deep-link from profile: /students?edit=<id>
  useEffect(() => {
    const editId = params.get('edit');
    if (editId) {
      const st = snap.students.find((s) => s.id === editId);
      if (st) setModal({ mode: 'edit', student: st });
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return snap.students.filter((s) => {
      if (!showArchived && s.archived) return false;
      if (classFilter && s.classId !== classFilter) return false;
      if (sectionFilter && s.sectionId !== sectionFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      const guardianPhones = snap.guardians.filter((g) => g.studentId === s.id).map((g) => g.phone).join(' ');
      return matchesQuery(q, studentName(s), s.studentId, s.admissionNo, s.phone, guardianPhones, classLabel(snap, s.classId, s.sectionId));
    });
  }, [snap, q, classFilter, sectionFilter, statusFilter, showArchived]);

  const sectionsForFilter = useMemo(
    () => snap.sections.filter((s) => !classFilter || s.classId === classFilter),
    [snap, classFilter],
  );

  const columns: Column<Student>[] = [
    {
      key: 'name', header: 'Student',
      render: (s) => (
        <Link to={`/students/${s.id}`} className="flex items-center gap-2.5">
          <Avatar name={studentName(s)} size="sm" />
          <span>
            <span className="link block">{studentName(s)}</span>
            <span className="text-xs text-slate-400">{s.studentId} · {s.admissionNo}</span>
          </span>
        </Link>
      ),
      sortValue: (s) => studentName(s),
    },
    { key: 'class', header: 'Class', render: (s) => classLabel(snap, s.classId, s.sectionId), sortValue: (s) => classLabel(snap, s.classId, s.sectionId) },
    { key: 'roll', header: 'Roll', render: (s) => s.rollNo ?? '—', sortValue: (s) => s.rollNo ?? '' },
    { key: 'gender', header: 'Gender', render: (s) => <span className="capitalize">{s.gender}</span> },
    {
      key: 'guardian', header: 'Guardian',
      render: (s) => {
        const g = snap.guardians.find((x) => x.studentId === s.id && x.isPrimary) ?? snap.guardians.find((x) => x.studentId === s.id);
        return g ? <span>{g.name}<span className="block text-xs text-slate-400">{g.phone}</span></span> : <span className="text-slate-400">—</span>;
      },
    },
    {
      key: 'due', header: 'Outstanding',
      render: (s) => {
        const due = studentOutstanding(snap, s.id);
        return due > 0 ? <span className="font-semibold text-amber-700">{money(due)}</span> : <span className="text-slate-400">—</span>;
      },
      sortValue: (s) => studentOutstanding(snap, s.id),
    },
    { key: 'status', header: 'Status', render: (s) => (s.archived ? <Badge tone="slate">Archived</Badge> : <StatusPill status={s.status} />) },
    {
      key: 'actions', header: 'Actions', className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => navigate(`/students/${s.id}`)}>View</button>
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', student: s })}>Edit</button>
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs" title="Print profile" onClick={() => navigate(`/print/student/${s.id}`)}><Printer className="h-3.5 w-3.5" /></button>
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" title="Delete" onClick={() => setDeleteTarget(s)}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
  ];

  const doExport = (): void => {
    exportCSV(
      'students',
      ['Student ID', 'Admission No', 'Name', 'Gender', 'DOB', 'Class', 'Section', 'Roll', 'Status', 'Phone', 'Admission Date'],
      filtered.map((s) => [
        s.studentId, s.admissionNo, studentName(s), s.gender, fmt.date(s.dob),
        snap.classes.find((c) => c.id === s.classId)?.name ?? '',
        snap.sections.find((x) => x.id === s.sectionId)?.name ?? '',
        s.rollNo ?? '', s.archived ? 'archived' : s.status, s.phone ?? '', fmt.date(s.admissionDate),
      ]),
    );
    toast.success(`Exported ${filtered.length} students to CSV`);
  };

  const doDelete = (): void => {
    if (!deleteTarget) return;
    snap.guardians.filter((g) => g.studentId === deleteTarget.id).forEach((g) => remove('guardians', g.id));
    remove('students', deleteTarget.id);
    toast.success('Student record deleted');
    setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${filtered.length} of ${snap.students.length} records`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={doExport}><Download className="h-4 w-4" /> Export</button>
            <button type="button" className="btn-secondary" onClick={() => setPromoteOpen(true)}><ArrowUpRight className="h-4 w-4" /> Promote / Move</button>
            <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Admit student</button>
          </>
        }
      />

      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <SearchInput value={q} onChange={setQ} placeholder="Name, ID, admission no, phone…" className="lg:col-span-2" />
          <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(''); }} className="input">
            <option value="">All classes</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="input">
            <option value="">All sections</option>
            {sectionsForFilter.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input flex-1">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
            <button type="button" onClick={() => setShowArchived((v) => !v)} className={cn('btn-secondary whitespace-nowrap !px-2.5', showArchived && '!border-[var(--brand-primary)] !text-[var(--brand-primary)]')} title="Toggle archived">
              Archived
            </button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          keyOf={(s) => s.id}
          emptyTitle="No students found"
          emptyHint="Try adjusting filters, or admit the first student."
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Admit student</button>}
        />
      </Card>

      <StudentModal
        key={modal ? `${modal.mode}-${modal.student?.id ?? 'new'}` : 'closed'}
        modal={modal}
        onClose={() => setModal(null)}
      />
      <PromoteModal open={promoteOpen} onClose={() => setPromoteOpen(false)} onMove={moveStudents} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete student?"
        message={`Permanently delete ${deleteTarget ? studentName(deleteTarget) : ''}? Guardians linked to this student will also be removed. Fee and exam history is preserved anonymously.`}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ------------------------------- student form ------------------------------ */

function StudentModal(props: { modal: { mode: 'add' | 'edit'; student?: Student } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const remove = useDB((s) => s.remove);
  const school = useSchool();

  const editing = props.modal?.student;
  const [form, setForm] = useState<FormState>(() => {
    if (editing) {
      const gs = snap.guardians.filter((g) => g.studentId === editing.id);
      return {
        studentId: editing.studentId, admissionNo: editing.admissionNo,
        firstName: editing.firstName, middleName: editing.middleName ?? '', lastName: editing.lastName,
        gender: editing.gender, dob: editing.dob, bloodGroup: editing.bloodGroup ?? '', nationality: editing.nationality ?? '',
        religion: editing.religion ?? '', phone: editing.phone ?? '', email: editing.email ?? '', address: editing.address ?? '',
        city: editing.city ?? '', previousSchool: editing.previousSchool ?? '', admissionDate: editing.admissionDate,
        classId: editing.classId, sectionId: editing.sectionId ?? '', rollNo: editing.rollNo ?? '', status: editing.status,
        routeId: editing.routeId ?? '', pickupPoint: editing.pickupPoint ?? '', dropPoint: editing.dropPoint ?? '',
        notes: editing.notes ?? '',
        guardians: gs.length ? gs.map((g) => ({ name: g.name, relationship: g.relationship, phone: g.phone, email: g.email ?? '', occupation: g.occupation ?? '', isEmergency: g.isEmergency })) : [blankGuardian()],
      };
    }
    return {
      studentId: nextStudentId(snap), admissionNo: nextAdmissionNo(snap),
      firstName: '', middleName: '', lastName: '', gender: 'male', dob: '', bloodGroup: '', nationality: '',
      religion: '', phone: '', email: '', address: '', city: school.city, previousSchool: '',
      admissionDate: todayISO(), classId: '', sectionId: '', rollNo: '', status: 'active',
      routeId: '', pickupPoint: '', dropPoint: '', notes: '', guardians: [blankGuardian()],
    };
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = (patch: Partial<FormState>): void => setForm((f) => ({ ...f, ...patch }));

  const sections = snap.sections.filter((s) => s.classId === form.classId);
  const routeStops = snap.routes.find((r) => r.id === form.routeId)?.stops ?? [];

  const validate = (): Errors => {
    const e: Errors = {};
    const req = (k: string, v: unknown): void => {
      const m = required(v);
      if (m) e[k] = m;
    };
    req('firstName', form.firstName);
    req('lastName', form.lastName);
    req('dob', form.dob);
    req('admissionDate', form.admissionDate);
    req('classId', form.classId);
    const em = isEmail(form.email);
    if (em) e.email = em;
    const ph = isPhone(form.phone);
    if (ph) e.phone = ph;
    if (form.guardians.some((g) => g.name.trim() && !g.phone.trim())) e.guardians = 'Guardians with a name need a phone number';
    const gem = form.guardians.find((g) => g.email && isEmail(g.email));
    if (gem) e.guardians = `Invalid guardian email: ${gem.email}`;
    // duplicate detection
    const dup = snap.students.find((s) => s.id !== editing?.id && (s.studentId === form.studentId || s.admissionNo === form.admissionNo));
    if (dup) e.studentId = `Duplicate: ${studentName(dup)} already uses this ID/admission no`;
    return e;
  };

  const save = (): void => {
    const e = validate();
    setErrors(e);
    if (hasErrors(e)) return;
    const currentYear = snap.academicYears.find((y) => y.isCurrent)?.id ?? snap.academicYears[0]?.id ?? '';
    const payload = {
      studentId: form.studentId.trim(), admissionNo: form.admissionNo.trim(),
      firstName: form.firstName.trim(), middleName: form.middleName.trim() || undefined, lastName: form.lastName.trim(),
      gender: form.gender, dob: form.dob, bloodGroup: form.bloodGroup || undefined,
      nationality: form.nationality.trim() || undefined, religion: form.religion.trim() || undefined,
      phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
      address: form.address.trim() || undefined, city: form.city.trim() || undefined,
      previousSchool: form.previousSchool.trim() || undefined, admissionDate: form.admissionDate,
      classId: form.classId, sectionId: form.sectionId || undefined, rollNo: form.rollNo.trim() || undefined,
      status: form.status, routeId: form.routeId || undefined,
      pickupPoint: form.pickupPoint.trim() || undefined, dropPoint: form.dropPoint.trim() || undefined,
      notes: form.notes.trim() || undefined, academicYearId: currentYear, updatedAt: nowISO(),
    };
    let studentId = editing?.id ?? '';
    if (editing) {
      update('students', editing.id, payload);
      snap.guardians.filter((g) => g.studentId === editing.id).forEach((g) => remove('guardians', g.id));
      toast.success('Student updated');
    } else {
      studentId = create('students', {
        ...payload,
        admissionClassId: form.classId,
        archived: false,
        createdAt: nowISO(),
      });
      toast.success(`${studentName({ ...payload, id: studentId } as Student)} admitted successfully`);
    }
    form.guardians.filter((g) => g.name.trim()).forEach((g, i) => {
      const rec: Omit<Guardian, 'id'> = {
        studentId, name: g.name.trim(), relationship: g.relationship.trim() || 'Guardian',
        phone: g.phone.trim(), email: g.email.trim() || undefined, occupation: g.occupation.trim() || undefined,
        isEmergency: i === 0 ? true : g.isEmergency, isPrimary: i === 0,
      };
      create('guardians', rec);
    });
    props.onClose();
  };

  const setGuardian = (i: number, patch: Partial<GuardianDraft>): void => {
    set({ guardians: form.guardians.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  };

  return (
    <Modal
      open={!!props.modal}
      onClose={props.onClose}
      title={editing ? `Edit ${studentName(editing)}` : 'Admit new student'}
      subtitle={editing ? `${editing.studentId} · ${editing.admissionNo}` : 'Registration creates the profile, guardian links and fee eligibility'}
      size="xl"
      footer={
        <>
          {editing ? (
            <button
              type="button"
              className="btn-secondary mr-auto"
              onClick={() => {
                update('students', editing.id, { archived: !editing.archived });
                toast.success(editing.archived ? 'Student unarchived' : 'Student archived');
                props.onClose();
              }}
            >
              {editing.archived ? 'Unarchive' : 'Archive'}
            </button>
          ) : null}
          <button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save}>{editing ? 'Save changes' : 'Admit student'}</button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Identity</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Student ID" error={errors.studentId}><input className={cn('input', errors.studentId && 'input-error')} value={form.studentId} onChange={(e) => set({ studentId: e.target.value })} /></Field>
            <Field label="Admission no"><input className="input" value={form.admissionNo} onChange={(e) => set({ admissionNo: e.target.value })} /></Field>
            <Field label="Admission date" error={errors.admissionDate}><input type="date" className="input" value={form.admissionDate} onChange={(e) => set({ admissionDate: e.target.value })} /></Field>
            <Field label="First name" error={errors.firstName}><input className="input" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} placeholder="e.g. Sara" /></Field>
            <Field label="Middle name" optional><input className="input" value={form.middleName} onChange={(e) => set({ middleName: e.target.value })} /></Field>
            <Field label="Last name" error={errors.lastName}><input className="input" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} placeholder="e.g. Khan" /></Field>
            <Field label="Gender"><select className="input" value={form.gender} onChange={(e) => set({ gender: e.target.value as Gender })}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
            <Field label="Date of birth" error={errors.dob}><input type="date" className="input" value={form.dob} onChange={(e) => set({ dob: e.target.value })} /></Field>
            <Field label="Blood group" optional>
              <select className="input" value={form.bloodGroup} onChange={(e) => set({ bloodGroup: e.target.value })}>
                <option value="">—</option>{['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Nationality" optional><input className="input" value={form.nationality} onChange={(e) => set({ nationality: e.target.value })} /></Field>
            {school.religionFieldEnabled ? <Field label="Religion" optional><input className="input" value={form.religion} onChange={(e) => set({ religion: e.target.value })} /></Field> : null}
            <Field label="Previous school" optional><input className="input" value={form.previousSchool} onChange={(e) => set({ previousSchool: e.target.value })} /></Field>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Contact</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Phone" optional error={errors.phone}><input className="input" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+1 …" /></Field>
            <Field label="Email" optional error={errors.email}><input className="input" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="student@example.com" /></Field>
            <Field label="City" optional><input className="input" value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label="Address" optional className="sm:col-span-3"><input className="input" value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Enrollment</h4>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Class" error={errors.classId}>
              <select className="input" value={form.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })}>
                <option value="">Select…</option>
                {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Section" optional>
              <select className="input" value={form.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>
                <option value="">—</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Roll no" optional><input className="input" value={form.rollNo} onChange={(e) => set({ rollNo: e.target.value })} /></Field>
            <Field label="Status">
              <select className="input capitalize" value={form.status} onChange={(e) => set({ status: e.target.value as StudentStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Transport (optional)</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Route" optional>
              <select className="input" value={form.routeId} onChange={(e) => set({ routeId: e.target.value })}>
                <option value="">No transport</option>
                {snap.routes.filter((r) => r.status === 'active').map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
              </select>
            </Field>
            <Field label="Pickup point" optional>
              <select className="input" value={form.pickupPoint} onChange={(e) => set({ pickupPoint: e.target.value })}>
                <option value="">—</option>
                {routeStops.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Drop-off point" optional>
              <select className="input" value={form.dropPoint} onChange={(e) => set({ dropPoint: e.target.value })}>
                <option value="">—</option>
                {routeStops.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Guardians</h4>
            <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => set({ guardians: [...form.guardians, blankGuardian()] })}><Plus className="h-3.5 w-3.5" /> Add guardian</button>
          </div>
          {errors.guardians ? <p className="mb-2 text-xs text-red-600">{errors.guardians}</p> : null}
          <div className="space-y-3">
            {form.guardians.map((g, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">{i === 0 ? 'Primary guardian' : `Guardian ${i + 1}`}</p>
                  {form.guardians.length > 1 ? <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => set({ guardians: form.guardians.filter((_, idx) => idx !== i) })}>Remove</button> : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input className="input" placeholder="Full name" value={g.name} onChange={(e) => setGuardian(i, { name: e.target.value })} />
                  <input className="input" placeholder="Relationship (Father/Mother…)" value={g.relationship} onChange={(e) => setGuardian(i, { relationship: e.target.value })} />
                  <input className="input" placeholder="Phone" value={g.phone} onChange={(e) => setGuardian(i, { phone: e.target.value })} />
                  <input className="input" placeholder="Email (optional)" value={g.email} onChange={(e) => setGuardian(i, { email: e.target.value })} />
                  <input className="input" placeholder="Occupation (optional)" value={g.occupation} onChange={(e) => setGuardian(i, { occupation: e.target.value })} />
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={i === 0 || g.isEmergency} disabled={i === 0} onChange={(e) => setGuardian(i, { isEmergency: e.target.checked })} className="h-4 w-4 accent-[var(--brand-primary)]" />
                    Emergency contact
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Field label="Notes" optional><textarea className="input" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* ------------------------------ promote modal ------------------------------ */

function PromoteModal(props: { open: boolean; onClose: () => void; onMove: (ids: string[], classId: string, sectionId?: string) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const [fromClass, setFromClass] = useState('');
  const [fromSection, setFromSection] = useState('');
  const [toClass, setToClass] = useState('');
  const [toSection, setToSection] = useState('');

  const pupils = snap.students.filter((s) => s.status === 'active' && !s.archived && (!fromClass || s.classId === fromClass) && (!fromSection || s.sectionId === fromSection));
  const toSections = snap.sections.filter((s) => s.classId === toClass);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Promote / move students"
      subtitle="Bulk-transfer students between classes and sections"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={!toClass || pupils.length === 0}
            onClick={() => {
              props.onMove(pupils.map((p) => p.id), toClass, toSection || undefined);
              toast.success(`Moved ${pupils.length} students to ${classLabel(snap, toClass, toSection || undefined)}`);
              props.onClose();
            }}
          >
            Move {pupils.length} students
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From class" optional>
          <select className="input" value={fromClass} onChange={(e) => { setFromClass(e.target.value); setFromSection(''); }}>
            <option value="">All classes</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="From section" optional>
          <select className="input" value={fromSection} onChange={(e) => setFromSection(e.target.value)}>
            <option value="">All sections</option>
            {snap.sections.filter((s) => !fromClass || s.classId === fromClass).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="To class">
          <select className="input" value={toClass} onChange={(e) => { setToClass(e.target.value); setToSection(''); }}>
            <option value="">Select…</option>
            {snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="To section" optional>
          <select className="input" value={toSection} onChange={(e) => setToSection(e.target.value)}>
            <option value="">Keep / none</option>
            {toSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      {pupils.length === 0 ? <EmptyState icon={GraduationCap} title="No matching students" hint="Adjust the source class/section." /> : (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {pupils.length} active student{pupils.length === 1 ? '' : 's'} will be moved. Attendance, fee and exam history is preserved.
        </p>
      )}
    </Modal>
  );
}