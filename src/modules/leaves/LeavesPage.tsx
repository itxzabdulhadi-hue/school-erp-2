import { useMemo, useState } from 'react';
import { Check, Download, Plus, Trash2, X } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, employeeName, staffName, studentName, teacherName } from '../../lib/db/selectors';
import type { LeaveRequest, LeaveStatus } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { exportCSV, matchesQuery, nowISO } from '../../lib/utils';
import { Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatusPill, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Annual Leave', 'Medical Leave', 'Family Function', 'Sports Event', 'Study Leave', 'Unpaid Leave', 'Other'];
type PersonTab = 'all' | 'student' | 'teacher' | 'staff';

export function LeavesPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const update = useDB((s) => s.update);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const [tab, setTab] = useState<PersonTab>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: LeaveRequest } | null>(null);
  const [deleting, setDeleting] = useState<LeaveRequest | null>(null);

  const applicant = (l: LeaveRequest): string => {
    if (l.personType === 'student') return studentName(snap.students.find((s) => s.id === l.studentId));
    return employeeName(snap, l.personType, l.employeeId);
  };

  const filtered = useMemo(
    () => [...snap.leaves]
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .filter((l) => (tab === 'all' || l.personType === tab) && (!statusFilter || l.status === statusFilter) && matchesQuery(q, applicant(l), l.leaveType, l.reason)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap, tab, statusFilter, q],
  );

  const decide = (l: LeaveRequest, status: LeaveStatus): void => {
    update('leaves', l.id, { status, decidedAt: nowISO() });
    toast.success(`Leave ${status}`);
  };

  return (
    <div>
      <PageHeader
        title="Leave management"
        subtitle={`${snap.leaves.filter((l) => l.status === 'pending').length} pending requests`}
        actions={
          <>
            <button
              type="button" className="btn-secondary"
              onClick={() => {
                exportCSV('leaves', ['Applicant', 'Type', 'Leave Type', 'From', 'To', 'Status', 'Reason'],
                  filtered.map((l) => [applicant(l), l.personType, l.leaveType, fmt.date(l.startDate), fmt.date(l.endDate), l.status, l.reason]));
                toast.success('Leave report exported');
              }}
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> New request</button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
          <Tabs<PersonTab>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'all', label: 'All', count: snap.leaves.length },
              { id: 'student', label: 'Students', count: snap.leaves.filter((l) => l.personType === 'student').length },
              { id: 'teacher', label: 'Teachers', count: snap.leaves.filter((l) => l.personType === 'teacher').length },
              { id: 'staff', label: 'Staff', count: snap.leaves.filter((l) => l.personType === 'staff').length },
            ]}
          />
          <div className="flex gap-2 lg:ml-auto">
            <SearchInput value={q} onChange={setQ} placeholder="Search…" className="flex-1 lg:w-56" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input lg:w-40">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <DataTable
          columns={[
            { key: 'who', header: 'Applicant', render: (l: LeaveRequest) => <span className="font-medium">{applicant(l)}<span className="block text-xs capitalize text-slate-400">{l.personType}{l.studentId ? ` · ${classLabel(snap, snap.students.find((s) => s.id === l.studentId)?.classId)}` : ''}</span></span>, sortValue: (l) => applicant(l) },
            { key: 'type', header: 'Leave type', render: (l: LeaveRequest) => l.leaveType },
            { key: 'dates', header: 'Duration', render: (l: LeaveRequest) => <span className="text-xs">{fmt.date(l.startDate)} → {fmt.date(l.endDate)}</span>, sortValue: (l) => l.startDate },
            { key: 'reason', header: 'Reason', render: (l: LeaveRequest) => <span className="block max-w-64 truncate" title={l.reason}>{l.reason}</span> },
            { key: 'status', header: 'Status', render: (l: LeaveRequest) => <StatusPill status={l.status} /> },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (l: LeaveRequest) => (
                <div className="flex justify-end gap-1">
                  {l.status === 'pending' ? (
                    <>
                      <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-emerald-700" title="Approve" onClick={() => decide(l, 'approved')}><Check className="h-3.5 w-3.5" /></button>
                      <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" title="Reject" onClick={() => decide(l, 'rejected')}><X className="h-3.5 w-3.5" /></button>
                    </>
                  ) : null}
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: l })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(l)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(l) => l.id}
          emptyTitle="No leave requests"
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>New request</button>}
        />
      </Card>
      <LeaveModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <ConfirmDialog open={!!deleting} title="Delete leave request?" message="This removes the request from the register." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('leaves', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function LeaveModal(props: { modal: { mode: 'add' | 'edit'; row?: LeaveRequest } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    personType: (row?.personType ?? 'student') as LeaveRequest['personType'],
    personId: row?.studentId ?? row?.employeeId ?? '',
    leaveType: row?.leaveType ?? 'Sick Leave',
    startDate: row?.startDate ?? '', endDate: row?.endDate ?? '',
    reason: row?.reason ?? '', status: (row?.status ?? 'pending') as LeaveStatus, notes: row?.notes ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const people = f.personType === 'student'
    ? snap.students.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: `${studentName(s)} — ${classLabel(snap, s.classId, s.sectionId)}` }))
    : f.personType === 'teacher'
      ? snap.teachers.map((t) => ({ id: t.id, label: `${teacherName(t)} (${t.employeeId})` }))
      : snap.staff.map((t) => ({ id: t.id, label: `${staffName(t)} (${t.employeeId})` }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.personId)) e.personId = 'Required';
    if (required(f.startDate)) e.startDate = 'Required';
    if (required(f.endDate)) e.endDate = 'Required';
    if (f.startDate && f.endDate && f.endDate < f.startDate) e.endDate = 'End date is before start date';
    if (required(f.reason)) e.reason = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      personType: f.personType,
      studentId: f.personType === 'student' ? f.personId : undefined,
      employeeId: f.personType === 'student' ? undefined : f.personId,
      leaveType: f.leaveType, startDate: f.startDate, endDate: f.endDate,
      reason: f.reason.trim(), status: f.status, notes: f.notes.trim() || undefined,
    };
    if (row) {
      update('leaves', row.id, { ...payload, decidedAt: f.status === 'pending' ? undefined : nowISO() });
      toast.success('Leave updated');
    } else {
      create('leaves', { ...payload, createdAt: nowISO(), decidedAt: f.status === 'pending' ? undefined : nowISO() });
      toast.success('Leave request recorded');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit leave request' : 'New leave request'}
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Applicant type">
          <select className="input capitalize" value={f.personType} onChange={(e) => set({ personType: e.target.value as LeaveRequest['personType'], personId: '' })}>
            <option value="student">Student</option><option value="teacher">Teacher</option><option value="staff">Staff</option>
          </select>
        </Field>
        <Field label="Applicant" error={errors.personId}>
          <select className="input" value={f.personId} onChange={(e) => set({ personId: e.target.value })}>
            <option value="">Select…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Leave type">
          <select className="input" value={f.leaveType} onChange={(e) => set({ leaveType: e.target.value })}>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="input capitalize" value={f.status} onChange={(e) => set({ status: e.target.value as LeaveStatus })}>
            <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
        </Field>
        <Field label="Start date" error={errors.startDate}><input type="date" className="input" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
        <Field label="End date" error={errors.endDate}><input type="date" className="input" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
        <Field label="Reason" error={errors.reason} className="sm:col-span-2"><textarea className="input" rows={2} value={f.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
        <Field label="Notes" optional className="sm:col-span-2"><input className="input" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
