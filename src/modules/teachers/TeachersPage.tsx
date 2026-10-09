import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { nextEmployeeId, teacherName } from '../../lib/db/selectors';
import type { EmploymentStatus, Gender, Teacher } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, isEmail, isPhone, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { cn, exportCSV, matchesQuery, nowISO } from '../../lib/utils';
import { Avatar, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatusPill } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const EMP_STATUSES: EmploymentStatus[] = ['active', 'on-leave', 'resigned', 'terminated', 'retired'];

export function TeachersPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [depFilter, setDepFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: Teacher } | null>(null);
  const [deleting, setDeleting] = useState<Teacher | null>(null);

  const filtered = useMemo(
    () => snap.teachers.filter((t) =>
      (!depFilter || t.departmentId === depFilter) &&
      (!statusFilter || t.status === statusFilter) &&
      matchesQuery(q, teacherName(t), t.employeeId, t.phone, t.email, t.designation),
    ),
    [snap, q, depFilter, statusFilter],
  );

  const doDelete = (): void => {
    if (!deleting) return;
    remove('teachers', deleting.id);
    toast.success('Teacher record deleted');
    setDeleting(null);
  };

  const doExport = (): void => {
    exportCSV('teachers', ['Employee ID', 'Name', 'Phone', 'Email', 'Department', 'Designation', 'Qualification', 'Status', 'Joining Date'],
      filtered.map((t) => [t.employeeId, teacherName(t), t.phone, t.email ?? '', snap.departments.find((d) => d.id === t.departmentId)?.name ?? '', t.designation ?? '', t.qualification ?? '', t.status, fmt.date(t.joiningDate)]));
    toast.success(`Exported ${filtered.length} teachers`);
  };

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle={`${filtered.length} of ${snap.teachers.length} teachers`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={doExport}><Download className="h-4 w-4" /> Export</button>
            <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add teacher</button>
          </>
        }
      />
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3">
          <SearchInput value={q} onChange={setQ} placeholder="Name, employee ID, phone…" />
          <select value={depFilter} onChange={(e) => setDepFilter(e.target.value)} className="input">
            <option value="">All departments</option>
            {snap.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input capitalize">
            <option value="">All statuses</option>
            {EMP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <DataTable
          columns={[
            {
              key: 'name', header: 'Teacher',
              render: (t: Teacher) => (
                <Link to={`/teachers/${t.id}`} className="flex items-center gap-2.5">
                  <Avatar name={teacherName(t)} size="sm" />
                  <span><span className="link block">{teacherName(t)}</span><span className="text-xs text-slate-400">{t.employeeId}</span></span>
                </Link>
              ),
              sortValue: (t) => teacherName(t),
            },
            { key: 'contact', header: 'Contact', render: (t: Teacher) => <span>{t.phone}<span className="block text-xs text-slate-400">{t.email ?? '—'}</span></span> },
            { key: 'dept', header: 'Department', render: (t: Teacher) => snap.departments.find((d) => d.id === t.departmentId)?.name ?? '—' },
            { key: 'subjects', header: 'Subjects', render: (t: Teacher) => t.subjectIds.map((id) => snap.subjects.find((s) => s.id === id)?.code).filter(Boolean).join(', ') || '—' },
            { key: 'joined', header: 'Joined', render: (t: Teacher) => fmt.date(t.joiningDate), sortValue: (t) => t.joiningDate },
            { key: 'status', header: 'Status', render: (t: Teacher) => <StatusPill status={t.status} /> },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (t: Teacher) => (
                <div className="flex justify-end gap-1">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => navigate(`/teachers/${t.id}`)}>Profile</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: t })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(t)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(t) => t.id}
          emptyTitle="No teachers found"
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>Add teacher</button>}
        />
      </Card>
      <TeacherModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting ? teacherName(deleting) : ''}?`} message="The teacher record will be removed. Past attendance and timetable history stays for reporting." confirmLabel="Delete" onConfirm={doDelete} onCancel={() => setDeleting(null)} />
    </div>
  );
}

export function TeacherModal(props: { modal: { mode: 'add' | 'edit'; row?: Teacher } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    employeeId: row?.employeeId ?? nextEmployeeId(snap, 'T'),
    firstName: row?.firstName ?? '', lastName: row?.lastName ?? '', gender: (row?.gender ?? 'male') as Gender,
    dob: row?.dob ?? '', phone: row?.phone ?? '', email: row?.email ?? '', address: row?.address ?? '',
    qualification: row?.qualification ?? '', specialization: row?.specialization ?? '',
    joiningDate: row?.joiningDate ?? '', departmentId: row?.departmentId ?? '', designation: row?.designation ?? '',
    status: (row?.status ?? 'active') as EmploymentStatus, subjectIds: row?.subjectIds ?? [] as string[],
    salaryMonthly: row?.salaryMonthly?.toString() ?? '', notes: row?.notes ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.firstName)) e.firstName = 'Required';
    if (required(f.lastName)) e.lastName = 'Required';
    if (required(f.phone)) e.phone = 'Required';
    else {
      const m = isPhone(f.phone);
      if (m) e.phone = m;
    }
    if (required(f.joiningDate)) e.joiningDate = 'Required';
    const em = isEmail(f.email);
    if (em) e.email = em;
    const dup = snap.teachers.find((t) => t.id !== row?.id && t.employeeId === f.employeeId.trim());
    if (dup) e.employeeId = `Duplicate of ${teacherName(dup)}`;
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      employeeId: f.employeeId.trim(), firstName: f.firstName.trim(), lastName: f.lastName.trim(),
      gender: f.gender, dob: f.dob || undefined, phone: f.phone.trim(), email: f.email.trim() || undefined,
      address: f.address.trim() || undefined, qualification: f.qualification.trim() || undefined,
      specialization: f.specialization.trim() || undefined, joiningDate: f.joiningDate,
      departmentId: f.departmentId || undefined, designation: f.designation.trim() || undefined,
      status: f.status, subjectIds: f.subjectIds, salaryMonthly: f.salaryMonthly ? Number(f.salaryMonthly) : undefined,
      notes: f.notes.trim() || undefined, updatedAt: nowISO(),
    };
    if (row) {
      update('teachers', row.id, payload);
      toast.success('Teacher updated');
    } else {
      create('teachers', { ...payload, createdAt: nowISO() });
      toast.success('Teacher added');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit teacher' : 'Add teacher'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Employee ID" error={errors.employeeId}><input className={cn('input', errors.employeeId && 'input-error')} value={f.employeeId} onChange={(e) => set({ employeeId: e.target.value })} /></Field>
        <Field label="First name" error={errors.firstName}><input className="input" value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} /></Field>
        <Field label="Last name" error={errors.lastName}><input className="input" value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} /></Field>
        <Field label="Gender"><select className="input" value={f.gender} onChange={(e) => set({ gender: e.target.value as Gender })}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
        <Field label="Date of birth" optional><input type="date" className="input" value={f.dob} onChange={(e) => set({ dob: e.target.value })} /></Field>
        <Field label="Phone" error={errors.phone}><input className="input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Email" optional error={errors.email}><input className="input" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Qualification" optional><input className="input" value={f.qualification} onChange={(e) => set({ qualification: e.target.value })} placeholder="B.Ed, M.Sc…" /></Field>
        <Field label="Specialization" optional><input className="input" value={f.specialization} onChange={(e) => set({ specialization: e.target.value })} /></Field>
        <Field label="Joining date" error={errors.joiningDate}><input type="date" className="input" value={f.joiningDate} onChange={(e) => set({ joiningDate: e.target.value })} /></Field>
        <Field label="Department" optional>
          <select className="input" value={f.departmentId} onChange={(e) => set({ departmentId: e.target.value })}>
            <option value="">—</option>{snap.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Designation" optional><input className="input" value={f.designation} onChange={(e) => set({ designation: e.target.value })} placeholder="Senior Teacher" /></Field>
        <Field label="Status">
          <select className="input capitalize" value={f.status} onChange={(e) => set({ status: e.target.value as EmploymentStatus })}>
            {EMP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Monthly salary" optional><input type="number" min={0} className="input" value={f.salaryMonthly} onChange={(e) => set({ salaryMonthly: e.target.value })} /></Field>
        <Field label="Address" optional className="sm:col-span-3"><input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field label="Subjects" optional className="sm:col-span-3">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {snap.subjects.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                <input type="checkbox" checked={f.subjectIds.includes(s.id)} onChange={(e) => set({ subjectIds: e.target.checked ? [...f.subjectIds, s.id] : f.subjectIds.filter((x) => x !== s.id) })} className="h-4 w-4 accent-[var(--brand-primary)]" />
                {s.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Notes" optional className="sm:col-span-3"><textarea className="input" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
