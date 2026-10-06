import { useMemo, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { nextEmployeeId, staffName } from '../../lib/db/selectors';
import type { EmploymentStatus, Gender, StaffMember } from '../../lib/db/types';
import { useFmt, useMoney } from '../../lib/useSchool';
import { hasErrors, isEmail, isPhone, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { cn, exportCSV, matchesQuery, nowISO } from '../../lib/utils';
import { Avatar, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatusPill } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const EMP_STATUSES: EmploymentStatus[] = ['active', 'on-leave', 'resigned', 'terminated', 'retired'];

const ROLES = ['Accountant', 'Receptionist', 'Librarian', 'IT Support Officer', 'Security Supervisor', 'Security Guard', 'Driver', 'Cleaner', 'Administrator', 'Lab Assistant', 'Nurse', 'Other'];

export function StaffPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const [depFilter, setDepFilter] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: StaffMember } | null>(null);
  const [viewing, setViewing] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);

  const filtered = useMemo(
    () => snap.staff.filter((t) =>
      (!depFilter || t.departmentId === depFilter) && matchesQuery(q, staffName(t), t.employeeId, t.phone, t.designation),
    ),
    [snap, q, depFilter],
  );

  const doExport = (): void => {
    exportCSV('staff', ['Employee ID', 'Name', 'Phone', 'Department', 'Designation', 'Status', 'Joining Date'],
      filtered.map((t) => [t.employeeId, staffName(t), t.phone, snap.departments.find((d) => d.id === t.departmentId)?.name ?? '', t.designation ?? '', t.status, fmt.date(t.joiningDate)]));
    toast.success(`Exported ${filtered.length} staff records`);
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={`${filtered.length} of ${snap.staff.length} non-teaching employees`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={doExport}><Download className="h-4 w-4" /> Export</button>
            <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add staff</button>
          </>
        }
      />
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
          <SearchInput value={q} onChange={setQ} placeholder="Name, employee ID, role…" />
          <select value={depFilter} onChange={(e) => setDepFilter(e.target.value)} className="input">
            <option value="">All departments</option>
            {snap.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <DataTable
          columns={[
            {
              key: 'name', header: 'Employee',
              render: (t: StaffMember) => (
                <button type="button" className="flex items-center gap-2.5" onClick={() => setViewing(t)}>
                  <Avatar name={staffName(t)} size="sm" />
                  <span className="text-left"><span className="link block">{staffName(t)}</span><span className="text-xs text-slate-400">{t.employeeId}</span></span>
                </button>
              ),
              sortValue: (t) => staffName(t),
            },
            { key: 'role', header: 'Designation', render: (t: StaffMember) => <span className="font-medium">{t.designation ?? '—'}</span> },
            { key: 'dept', header: 'Department', render: (t: StaffMember) => snap.departments.find((d) => d.id === t.departmentId)?.name ?? '—' },
            { key: 'contact', header: 'Contact', render: (t: StaffMember) => t.phone },
            { key: 'joined', header: 'Joined', render: (t: StaffMember) => fmt.date(t.joiningDate), sortValue: (t) => t.joiningDate },
            { key: 'status', header: 'Status', render: (t: StaffMember) => <StatusPill status={t.status} /> },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (t: StaffMember) => (
                <div className="flex justify-end gap-1">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setViewing(t)}>View</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: t })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(t)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(t) => t.id}
          emptyTitle="No staff found"
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>Add staff</button>}
        />
      </Card>
      <StaffModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <StaffDetail staff={viewing} onClose={() => setViewing(null)} onEdit={() => { if (viewing) setModal({ mode: 'edit', row: viewing }); setViewing(null); }} />
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting ? staffName(deleting) : ''}?`}
        message="The staff record will be removed."
        confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('staff', deleting.id); toast.success('Staff record deleted'); setDeleting(null); }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function StaffModal(props: { modal: { mode: 'add' | 'edit'; row?: StaffMember } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    employeeId: row?.employeeId ?? nextEmployeeId(snap, 'S'),
    firstName: row?.firstName ?? '', lastName: row?.lastName ?? '', gender: (row?.gender ?? 'male') as Gender,
    dob: row?.dob ?? '', phone: row?.phone ?? '', email: row?.email ?? '', address: row?.address ?? '',
    joiningDate: row?.joiningDate ?? '', departmentId: row?.departmentId ?? '', designation: row?.designation ?? '',
    status: (row?.status ?? 'active') as EmploymentStatus, salaryMonthly: row?.salaryMonthly?.toString() ?? '', notes: row?.notes ?? '',
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
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      employeeId: f.employeeId.trim(), firstName: f.firstName.trim(), lastName: f.lastName.trim(), gender: f.gender,
      dob: f.dob || undefined, phone: f.phone.trim(), email: f.email.trim() || undefined, address: f.address.trim() || undefined,
      joiningDate: f.joiningDate, departmentId: f.departmentId || undefined, designation: f.designation.trim() || undefined,
      status: f.status, salaryMonthly: f.salaryMonthly ? Number(f.salaryMonthly) : undefined, notes: f.notes.trim() || undefined,
      updatedAt: nowISO(),
    };
    if (row) {
      update('staff', row.id, payload);
      toast.success('Staff updated');
    } else {
      create('staff', { ...payload, createdAt: nowISO() });
      toast.success('Staff added');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit staff' : 'Add staff'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Employee ID"><input className="input" value={f.employeeId} onChange={(e) => set({ employeeId: e.target.value })} /></Field>
        <Field label="First name" error={errors.firstName}><input className={cn('input', errors.firstName && 'input-error')} value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} /></Field>
        <Field label="Last name" error={errors.lastName}><input className={cn('input', errors.lastName && 'input-error')} value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} /></Field>
        <Field label="Gender"><select className="input" value={f.gender} onChange={(e) => set({ gender: e.target.value as Gender })}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
        <Field label="Date of birth" optional><input type="date" className="input" value={f.dob} onChange={(e) => set({ dob: e.target.value })} /></Field>
        <Field label="Phone" error={errors.phone}><input className={cn('input', errors.phone && 'input-error')} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Email" optional error={errors.email}><input className="input" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Joining date" error={errors.joiningDate}><input type="date" className={cn('input', errors.joiningDate && 'input-error')} value={f.joiningDate} onChange={(e) => set({ joiningDate: e.target.value })} /></Field>
        <Field label="Designation" optional>
          <input className="input" list="staff-roles" value={f.designation} onChange={(e) => set({ designation: e.target.value })} placeholder="Select or type…" />
          <datalist id="staff-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
        </Field>
        <Field label="Department" optional>
          <select className="input" value={f.departmentId} onChange={(e) => set({ departmentId: e.target.value })}>
            <option value="">—</option>{snap.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="input capitalize" value={f.status} onChange={(e) => set({ status: e.target.value as EmploymentStatus })}>
            {EMP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Monthly salary" optional><input type="number" min={0} className="input" value={f.salaryMonthly} onChange={(e) => set({ salaryMonthly: e.target.value })} /></Field>
        <Field label="Address" optional className="sm:col-span-3"><input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function StaffDetail(props: { staff: StaffMember | null; onClose: () => void; onEdit: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const fmt = useFmt();
  const money = useMoney();
  if (!props.staff) return <></>;
  const t = props.staff;
  const recs = snap.attendance.filter((a) => a.personType === 'employee' && a.employeeId === t.id);
  const present = recs.filter((r) => r.status === 'present' || r.status === 'half-day').length;
  const pct = recs.length ? Math.round((present / recs.length) * 1000) / 10 : 0;
  const leaves = snap.leaves.filter((l) => l.personType === 'staff' && l.employeeId === t.id);
  return (
    <Modal open onClose={props.onClose} title={staffName(t)} subtitle={`${t.employeeId} · ${t.designation ?? ''}`} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Close</button><button type="button" className="btn-primary" onClick={props.onEdit}>Edit</button></>}>
      <div className="flex items-start gap-3">
        <Avatar name={staffName(t)} size="lg" />
        <div className="grid flex-1 grid-cols-2 gap-2 text-sm">
          <p><span className="text-slate-500">Department: </span>{snap.departments.find((d) => d.id === t.departmentId)?.name ?? '—'}</p>
          <p><span className="text-slate-500">Status: </span><StatusPill status={t.status} /></p>
          <p><span className="text-slate-500">Phone: </span>{t.phone}</p>
          <p><span className="text-slate-500">Email: </span>{t.email ?? '—'}</p>
          <p><span className="text-slate-500">Joined: </span>{fmt.date(t.joiningDate)}</p>
          <p><span className="text-slate-500">Salary: </span><span className="font-semibold">{t.salaryMonthly ? money(t.salaryMonthly) : '—'}</span></p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Attendance — {pct}% ({present}/{recs.length})</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {[...recs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((r) => (
              <li key={r.id} className="flex justify-between text-xs"><span className="text-slate-500">{fmt.date(r.date)}</span><StatusPill status={r.status} /></li>
            ))}
            {recs.length === 0 ? <li className="text-xs text-slate-400">No records.</li> : null}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Leaves ({leaves.length})</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {leaves.map((l) => (
              <li key={l.id} className="flex justify-between text-xs"><span>{l.leaveType} <span className="text-slate-400">· {fmt.date(l.startDate)}</span></span><StatusPill status={l.status} /></li>
            ))}
            {leaves.length === 0 ? <li className="text-xs text-slate-400">No leave requests.</li> : null}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
