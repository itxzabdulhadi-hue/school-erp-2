import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Plus, Printer, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, nextCertNo, studentName } from '../../lib/db/selectors';
import type { Certificate, CertificateType } from '../../lib/db/types';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { matchesQuery, nowISO, todayISO } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatusPill } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

const TYPES: { id: CertificateType; label: string }[] = [
  { id: 'character', label: 'Character' }, { id: 'bonafide', label: 'Bonafide' }, { id: 'leaving', label: 'Leaving' },
  { id: 'transfer', label: 'Transfer' }, { id: 'enrollment', label: 'Enrollment' }, { id: 'custom', label: 'Custom' },
];

export function CertificatesPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const update = useDB((s) => s.update);
  const fmt = useFmt();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: Certificate } | null>(null);
  const [deleting, setDeleting] = useState<Certificate | null>(null);

  const filtered = useMemo(
    () => [...snap.certificates].sort((a, b) => b.issueDate.localeCompare(a.issueDate))
      .filter((c) => (!type || c.type === type) && matchesQuery(q, c.certNo, studentName(snap.students.find((s) => s.id === c.studentId)), c.purpose)),
    [snap, q, type],
  );

  return (
    <div>
      <PageHeader
        title="Certificates"
        subtitle="Branded, printable student certificates"
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> New certificate</button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TYPES.map((t) => (
          <button key={t.id} type="button" onClick={() => { setType(t.id); }} className="card flex items-center gap-2 p-3 text-left hover:shadow-pop">
            <BadgeCheck className="h-5 w-5 text-[var(--brand-primary)]" />
            <span><span className="block text-sm font-bold">{t.label}</span><span className="block text-xs text-slate-500">{snap.certificates.filter((c) => c.type === t.id).length} issued</span></span>
          </button>
        ))}
      </div>
      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
          <SearchInput value={q} onChange={setQ} placeholder="Certificate no, student, purpose…" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            <option value="">All types</option>{TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <DataTable
          columns={[
            { key: 'no', header: 'Certificate', render: (c: Certificate) => <span className="font-mono text-xs font-bold">{c.certNo}</span>, sortValue: (c) => c.certNo },
            { key: 'type', header: 'Type', render: (c: Certificate) => <Badge tone="blue">{c.type === 'custom' && c.customTitle ? c.customTitle : TYPES.find((t) => t.id === c.type)?.label}</Badge> },
            {
              key: 'student', header: 'Student',
              render: (c: Certificate) => {
                const s = snap.students.find((x) => x.id === c.studentId);
                return s ? <Link to={`/students/${s.id}`} className="link">{studentName(s)}<span className="block text-xs font-normal text-slate-400">{classLabel(snap, s.classId, s.sectionId)}</span></Link> : '—';
              },
            },
            { key: 'date', header: 'Issued', render: (c: Certificate) => fmt.date(c.issueDate), sortValue: (c) => c.issueDate },
            { key: 'purpose', header: 'Purpose', render: (c: Certificate) => <span className="text-xs">{c.purpose ?? '—'}</span> },
            { key: 'status', header: 'Status', render: (c: Certificate) => <StatusPill status={c.status} /> },
            {
              key: 'actions', header: 'Actions', className: 'text-right',
              render: (c: Certificate) => (
                <div className="flex justify-end gap-1">
                  {c.status === 'draft' ? <button type="button" className="btn-primary !px-2 !py-1 text-xs" onClick={() => { update('certificates', c.id, { status: 'issued' }); toast.success('Certificate issued'); }}>Issue</button> : null}
                  {c.status === 'issued' ? <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => { update('certificates', c.id, { status: 'revoked' }); toast.success('Certificate revoked'); }}>Revoke</button> : null}
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => navigate(`/print/certificate/${c.id}`)}><Printer className="h-3.5 w-3.5" /></button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: c })}>Edit</button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(c)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyOf={(c) => c.id}
          emptyTitle="No certificates yet"
          emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>New certificate</button>}
        />
      </Card>
      <CertModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.certNo}?`} message="The certificate record will be removed." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('certificates', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function CertModal(props: { modal: { mode: 'add' | 'edit'; row?: Certificate } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    type: (row?.type ?? 'bonafide') as CertificateType, customTitle: row?.customTitle ?? '', customBody: row?.customBody ?? '',
    studentId: row?.studentId ?? '', issueDate: row?.issueDate ?? todayISO(), purpose: row?.purpose ?? '',
    remarks: row?.remarks ?? '', status: (row?.status ?? 'draft') as Certificate['status'],
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.studentId)) e.studentId = 'Required';
    if (required(f.issueDate)) e.issueDate = 'Required';
    if (f.type === 'custom' && required(f.customBody)) e.customBody = 'Body text required for custom certificates';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      type: f.type, customTitle: f.customTitle.trim() || undefined, customBody: f.customBody.trim() || undefined,
      studentId: f.studentId, issueDate: f.issueDate, purpose: f.purpose.trim() || undefined,
      remarks: f.remarks.trim() || undefined, status: f.status,
    };
    if (row) {
      update('certificates', row.id, payload);
      toast.success('Certificate updated');
    } else {
      create('certificates', { ...payload, certNo: nextCertNo(snap), createdAt: nowISO() });
      toast.success('Certificate drafted');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit certificate' : 'New certificate'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <select className="input" value={f.type} onChange={(e) => set({ type: e.target.value as CertificateType })}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Student" error={errors.studentId}>
          <select className="input" value={f.studentId} onChange={(e) => set({ studentId: e.target.value })}>
            <option value="">Select…</option>
            {snap.students.map((s) => <option key={s.id} value={s.id}>{studentName(s)} — {classLabel(snap, s.classId, s.sectionId)}</option>)}
          </select>
        </Field>
        {f.type === 'custom' ? (
          <>
            <Field label="Custom title" optional><input className="input" value={f.customTitle} onChange={(e) => set({ customTitle: e.target.value })} /></Field>
            <div />
            <Field label="Custom body" error={errors.customBody} className="sm:col-span-2"><textarea className="input" rows={4} value={f.customBody} onChange={(e) => set({ customBody: e.target.value })} /></Field>
          </>
        ) : null}
        <Field label="Issue date" error={errors.issueDate}><input type="date" className="input" value={f.issueDate} onChange={(e) => set({ issueDate: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input capitalize" value={f.status} onChange={(e) => set({ status: e.target.value as Certificate['status'] })}>
            <option value="draft">Draft</option><option value="issued">Issued</option><option value="revoked">Revoked</option>
          </select>
        </Field>
        <Field label="Purpose" optional><input className="input" value={f.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="Passport application / admission / …" /></Field>
        <Field label="Remarks" optional><input className="input" value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
