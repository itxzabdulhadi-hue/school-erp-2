import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Printer, Trash2, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDB } from '../../lib/db/store';
import {
  classLabel, collectionByMethod, feeCollectionTrend, financeSummary, invoiceBalance,
  nextInvoiceNo, studentName,
} from '../../lib/db/selectors';
import type { FeeFrequency, FeeStructure, FeeType, Invoice, InvoiceItem, Payment, PaymentMethod } from '../../lib/db/types';
import { useFmt, useMoney, useSchool } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { exportCSV, matchesQuery, nowISO, todayISO, uid } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatCard, StatusPill, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

type TabId = 'overview' | 'invoices' | 'payments' | 'types' | 'structures';

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' }, { id: 'bank', label: 'Bank transfer' }, { id: 'card', label: 'Card' },
  { id: 'online', label: 'Online' }, { id: 'other', label: 'Other' },
];

export function FeesPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>('overview');
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const pay = params.get('pay');
    if (pay) {
      const inv = snap.invoices.find((i) => i.id === pay);
      if (inv) {
        setPayInvoice(inv);
        setTab('invoices');
      }
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="Fees & Finance" subtitle="Structures, invoices, payments and receipts" />
      <Card>
        <div className="p-3">
          <Tabs<TabId>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'invoices', label: 'Invoices', count: snap.invoices.length },
              { id: 'payments', label: 'Payments', count: snap.payments.length },
              { id: 'structures', label: 'Fee structures', count: snap.feeStructures.length },
              { id: 'types', label: 'Fee types', count: snap.feeTypes.length },
            ]}
          />
        </div>
        {tab === 'overview' ? <FinanceOverview onTab={setTab} /> : null}
        {tab === 'invoices' ? <InvoicesTab onPay={setPayInvoice} onView={setViewInvoice} /> : null}
        {tab === 'payments' ? <PaymentsTab onPay={setPayInvoice} /> : null}
        {tab === 'structures' ? <StructuresTab /> : null}
        {tab === 'types' ? <FeeTypesTab /> : null}
      </Card>
      <PaymentModal
        key={payInvoice?.id ?? 'new'}
        invoice={payInvoice}
        onClose={() => setPayInvoice(null)}
        onDone={(inv) => { setPayInvoice(null); setViewInvoice(snap.invoices.find((i) => i.id === inv.id) ?? inv); }}
      />
      <InvoiceDetail invoice={viewInvoice ? (snap.invoices.find((i) => i.id === viewInvoice.id) ?? viewInvoice) : null} onClose={() => setViewInvoice(null)} onPay={(inv) => { setViewInvoice(null); setPayInvoice(inv); }} />
    </div>
  );
}

/* --------------------------------- overview --------------------------------- */

function FinanceOverview(props: { onTab: (t: TabId) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const money = useMoney();
  const t = todayISO();
  const today = useMemo(() => financeSummary(snap, t, t), [snap, t]);
  const month = useMemo(() => financeSummary(snap, t.slice(0, 7) + '-01', t), [snap, t]);
  const year = useMemo(() => financeSummary(snap, t.slice(0, 4) + '-01-01', t), [snap, t]);
  const all = useMemo(() => financeSummary(snap), [snap]);
  const trend = useMemo(() => feeCollectionTrend(snap, 14), [snap]);
  const byMethod = useMemo(() => collectionByMethod(snap), [snap]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Collected today" value={money(today.collected)} sub={`${today.count} receipts`} tone="bg-emerald-100 text-emerald-700" onClick={() => props.onTab('payments')} />
        <StatCard icon={Wallet} label="Collected this month" value={money(month.collected)} sub={`${month.count} receipts`} tone="bg-blue-100 text-blue-700" onClick={() => props.onTab('payments')} />
        <StatCard icon={Wallet} label="Collected this year" value={money(year.collected)} sub={`${year.count} receipts`} tone="bg-violet-100 text-violet-700" onClick={() => props.onTab('payments')} />
        <StatCard icon={Wallet} label="Outstanding" value={money(all.outstanding)} sub={`${money(all.overdue)} overdue`} tone="bg-amber-100 text-amber-700" onClick={() => props.onTab('invoices')} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Overdue invoices</p><p className="text-xl font-bold text-red-600">{snap.invoices.filter((i) => i.status === 'overdue').length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Unpaid / partial</p><p className="text-xl font-bold">{snap.invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial').length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Discounts granted</p><p className="text-xl font-bold">{money(all.discounts)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Fines levied</p><p className="text-xl font-bold">{money(all.fines)}</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="section-title">Collection trend · last 14 days</h3>
          <div className="mt-2 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [money(Number(v)), 'Collected']} />
                <Bar dataKey="amount" fill={school.primaryColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="section-title">By payment method</h3>
          <ul className="mt-3 space-y-2.5">
            {byMethod.map((m) => (
              <li key={m.method} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-600">{METHODS.find((x) => x.id === m.method)?.label ?? m.method}</span>
                <span className="font-bold">{money(m.amount)}</span>
              </li>
            ))}
            {byMethod.length === 0 ? <li className="text-sm text-slate-400">No payments yet.</li> : null}
          </ul>
          <h3 className="section-title mb-2 mt-5">Top overdue</h3>
          <ul className="space-y-2">
            {snap.invoices.filter((i) => i.status === 'overdue').slice(0, 4).map((i) => (
              <li key={i.id} className="flex items-center justify-between text-sm">
                <Link to={`/students/${i.studentId}`} className="link truncate">{studentName(snap.students.find((s) => s.id === i.studentId))}</Link>
                <span className="font-bold text-red-600">{money(invoiceBalance(i))}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- invoices --------------------------------- */

function InvoicesTab(props: { onPay: (inv: Invoice) => void; onView: (inv: Invoice) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const update = useDB((s) => s.update);
  const generate = useDB((s) => s.generateInvoices);
  const money = useMoney();
  const fmt = useFmt();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: Invoice } | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [deleting, setDeleting] = useState<Invoice | null>(null);

  const filtered = useMemo(
    () => [...snap.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate))
      .filter((i) => (!status || i.status === status) && matchesQuery(q, i.invoiceNo, studentName(snap.students.find((s) => s.id === i.studentId)))),
    [snap, q, status],
  );

  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <SearchInput value={q} onChange={setQ} placeholder="Invoice no, student…" className="lg:col-span-2" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input capitalize">
          <option value="">All statuses</option>
          {['unpaid', 'partial', 'paid', 'overdue', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" className="btn-secondary" onClick={() => setGenOpen(true)}>Generate bulk</button>
        <button
          type="button" className="btn-secondary"
          onClick={() => {
            exportCSV('invoices', ['Invoice', 'Student', 'Term', 'Issue', 'Due', 'Total', 'Paid', 'Balance', 'Status'],
              filtered.map((i) => [i.invoiceNo, studentName(snap.students.find((x) => x.id === i.studentId)), i.term ?? '', fmt.date(i.issueDate), fmt.date(i.dueDate), i.total, i.paid, invoiceBalance(i), i.status]));
            toast.success('Invoices exported');
          }}
        >
          Export
        </button>
        <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}><Plus className="h-4 w-4" /> New invoice</button>
      </div>
      <DataTable
        columns={[
          {
            key: 'no', header: 'Invoice',
            render: (i: Invoice) => <button type="button" className="link font-semibold" onClick={() => props.onView(i)}>{i.invoiceNo}<span className="block text-xs font-normal text-slate-400">{i.term} · due {fmt.date(i.dueDate)}</span></button>,
            sortValue: (i) => i.invoiceNo,
          },
          { key: 'student', header: 'Student', render: (i: Invoice) => <Link to={`/students/${i.studentId}`} className="link">{studentName(snap.students.find((s) => s.id === i.studentId))}</Link> },
          { key: 'total', header: 'Total', render: (i: Invoice) => <span className="font-semibold">{money(i.total)}</span>, sortValue: (i) => i.total },
          { key: 'paid', header: 'Paid', render: (i: Invoice) => <span className="text-emerald-700">{money(i.paid)}</span> },
          { key: 'balance', header: 'Balance', render: (i: Invoice) => <span className={invoiceBalance(i) > 0 ? 'font-bold text-amber-700' : 'text-slate-400'}>{money(invoiceBalance(i))}</span>, sortValue: (i) => invoiceBalance(i) },
          { key: 'status', header: 'Status', render: (i: Invoice) => <StatusPill status={i.status} /> },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (i: Invoice) => (
              <div className="flex justify-end gap-1">
                {i.status !== 'paid' && i.status !== 'cancelled' ? <button type="button" className="btn-primary !px-2 !py-1 text-xs" onClick={() => props.onPay(i)}>Pay</button> : null}
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => navigate(`/print/invoice/${i.id}`)} title="Print"><Printer className="h-3.5 w-3.5" /></button>
                {i.status !== 'cancelled' && i.status !== 'paid' ? <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setModal({ mode: 'edit', row: i })}>Edit</button> : null}
                {i.status !== 'cancelled' ? <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => { update('invoices', i.id, { status: 'cancelled' }); toast.success('Invoice cancelled'); }}>Cancel</button> : null}
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(i)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={filtered}
        keyOf={(i) => i.id}
        emptyTitle="No invoices found"
        emptyAction={<button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>New invoice</button>}
      />
      <InvoiceModal key={modal ? `${modal.mode}-${modal.row?.id ?? 'new'}` : 'closed'} modal={modal} onClose={() => setModal(null)} />
      <GenerateModal
        key={genOpen ? 'open' : 'closed'}
        open={genOpen} onClose={() => setGenOpen(false)}
        onRun={(input) => {
          const r = generate(input);
          toast.success(r.created ? `Created ${r.created} invoices (${r.skipped} skipped)` : 'No new invoices — all students already billed for this term');
          setGenOpen(false);
        }}
      />
      <ConfirmDialog
        open={!!deleting} title={`Delete ${deleting?.invoiceNo}?`} message="Linked payments stay in history but the invoice will be removed. Prefer Cancel to keep the audit trail." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('invoices', deleting.id); toast.success('Invoice deleted'); setDeleting(null); }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function InvoiceModal(props: { modal: { mode: 'add' | 'edit'; row?: Invoice } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const school = useSchool();
  const row = props.modal?.row;
  const [f, setF] = useState({
    studentId: row?.studentId ?? '', term: row?.term ?? school.currentTerm,
    issueDate: row?.issueDate ?? todayISO(), dueDate: row?.dueDate ?? '',
    discount: String(row?.discount ?? 0), fine: String(row?.fine ?? 0), notes: row?.notes ?? '',
    items: (row?.items ?? []) as InvoiceItem[],
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const student = snap.students.find((s) => s.id === f.studentId);
  const subtotal = f.items.reduce((a, i) => a + i.amount, 0);
  const total = Math.max(0, subtotal - (Number(f.discount) || 0) + (Number(f.fine) || 0));

  const prefill = (): void => {
    if (!student) {
      toast.error('Select a student first');
      return;
    }
    const structure = snap.feeStructures.find((x) => x.classId === student.classId) ?? snap.feeStructures.find((x) => !x.classId);
    if (!structure) {
      toast.error('No fee structure found for this class');
      return;
    }
    set({
      items: structure.items.map((it) => {
        const ft = snap.feeTypes.find((x) => x.id === it.feeTypeId);
        return { id: uid('ii'), feeTypeId: it.feeTypeId, label: ft?.name ?? 'Fee', amount: it.amount };
      }),
    });
    toast.success(`Loaded "${structure.name}"`);
  };

  const save = (): void => {
    const e: Errors = {};
    if (required(f.studentId)) e.studentId = 'Required';
    if (required(f.dueDate)) e.dueDate = 'Required';
    if (!f.items.length) e.items = 'Add at least one fee item';
    if (f.items.some((i) => !i.label.trim() || !(i.amount > 0))) e.items = 'Each item needs a label and amount > 0';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      studentId: f.studentId, academicYearId: student?.academicYearId ?? '', term: f.term,
      issueDate: f.issueDate, dueDate: f.dueDate, items: f.items,
      discount: Number(f.discount) || 0, fine: Number(f.fine) || 0, total,
      notes: f.notes.trim() || undefined,
    };
    if (row) {
      const status = row.paid >= total ? 'paid' : row.paid > 0 ? 'partial' : f.dueDate < todayISO() ? 'overdue' : 'unpaid';
      update('invoices', row.id, { ...payload, paid: row.paid, status });
      toast.success('Invoice updated');
    } else {
      create('invoices', { ...payload, invoiceNo: nextInvoiceNo(snap), paid: 0, status: f.dueDate < todayISO() ? 'overdue' : 'unpaid', createdAt: nowISO() });
      toast.success('Invoice created');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? `Edit ${row.invoiceNo}` : 'New invoice'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save invoice</button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Student" error={errors.studentId} className="sm:col-span-2">
          <select className="input" value={f.studentId} onChange={(e) => set({ studentId: e.target.value })}>
            <option value="">Select…</option>
            {snap.students.filter((s) => s.status === 'active' && !s.archived).map((s) => <option key={s.id} value={s.id}>{studentName(s)} — {classLabel(snap, s.classId, s.sectionId)}</option>)}
          </select>
        </Field>
        <Field label="Term"><input className="input" value={f.term} onChange={(e) => set({ term: e.target.value })} /></Field>
        <Field label="Issue date"><input type="date" className="input" value={f.issueDate} onChange={(e) => set({ issueDate: e.target.value })} /></Field>
        <Field label="Due date" error={errors.dueDate}><input type="date" className="input" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
        <div className="flex items-end"><button type="button" className="btn-secondary w-full" onClick={prefill}>Load from structure</button></div>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Fee items</h4>
          <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => set({ items: [...f.items, { id: uid('ii'), feeTypeId: snap.feeTypes[0]?.id ?? '', label: snap.feeTypes[0]?.name ?? '', amount: snap.feeTypes[0]?.defaultAmount ?? 0 }] })}><Plus className="h-3.5 w-3.5" /> Add item</button>
        </div>
        {errors.items ? <p className="mb-2 text-xs text-red-600">{errors.items}</p> : null}
        <div className="space-y-2">
          {f.items.map((it, i) => (
            <div key={it.id} className="grid grid-cols-[1fr_110px_32px] gap-2">
              <select
                className="input" value={it.feeTypeId}
                onChange={(e) => {
                  const ft = snap.feeTypes.find((x) => x.id === e.target.value);
                  set({ items: f.items.map((x, idx) => (idx === i ? { ...x, feeTypeId: e.target.value, label: ft?.name ?? x.label, amount: x.amount || ft?.defaultAmount || 0 } : x)) });
                }}
              >
                {snap.feeTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
              </select>
              <input type="number" min={0} className="input" value={it.amount} onChange={(e) => set({ items: f.items.map((x, idx) => (idx === i ? { ...x, amount: Number(e.target.value) || 0 } : x)) })} />
              <button type="button" className="btn-ghost !px-2 text-red-600" onClick={() => set({ items: f.items.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {f.items.length === 0 ? <p className="rounded-lg bg-slate-50 py-4 text-center text-xs text-slate-400">No items yet.</p> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Field label="Discount"><input type="number" min={0} className="input" value={f.discount} onChange={(e) => set({ discount: e.target.value })} /></Field>
        <Field label="Fine"><input type="number" min={0} className="input" value={f.fine} onChange={(e) => set({ fine: e.target.value })} /></Field>
        <div className="rounded-lg bg-slate-50 p-2.5 sm:col-span-2"><p className="text-xs text-slate-500">Total payable</p><p className="text-lg font-extrabold">{total.toLocaleString()}</p></div>
        <Field label="Notes" optional className="sm:col-span-4"><input className="input" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function GenerateModal(props: { open: boolean; onClose: () => void; onRun: (input: { feeStructureId: string; term: string; issueDate: string; dueDate: string; classId?: string }) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const school = useSchool();
  const [f, setF] = useState({ feeStructureId: snap.feeStructures[0]?.id ?? '', term: school.currentTerm, issueDate: todayISO(), dueDate: '', classId: '' });
  if (!props.open) return <></>;
  return (
    <Modal open onClose={props.onClose} title="Bulk invoice generation" subtitle="One invoice per active unbilled student in scope"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" disabled={!f.feeStructureId || !f.dueDate} onClick={() => props.onRun({ ...f, classId: f.classId || undefined })}>Generate</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fee structure" className="sm:col-span-2">
          <select className="input" value={f.feeStructureId} onChange={(e) => setF({ ...f, feeStructureId: e.target.value })}>
            {snap.feeStructures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Term"><input className="input" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} /></Field>
        <Field label="Class scope" optional>
          <select className="input" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
            <option value="">All classes</option>{snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Issue date"><input type="date" className="input" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} /></Field>
        <Field label="Due date"><input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* ------------------------------- invoice detail ----------------------------- */

function InvoiceDetail(props: { invoice: Invoice | null; onClose: () => void; onPay: (inv: Invoice) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const money = useMoney();
  const fmt = useFmt();
  const navigate = useNavigate();
  if (!props.invoice) return <></>;
  const inv = props.invoice;
  const student = snap.students.find((s) => s.id === inv.studentId);
  const pays = snap.payments.filter((p) => p.invoiceId === inv.id);
  const subtotal = inv.items.reduce((a, i) => a + i.amount, 0);
  return (
    <Modal open onClose={props.onClose} title={inv.invoiceNo} subtitle={student ? `${studentName(student)} · ${classLabel(snap, student.classId, student.sectionId)}` : ''} size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/print/invoice/${inv.id}`)}><Printer className="h-4 w-4" /> Print</button>
          <button type="button" className="btn-secondary" onClick={props.onClose}>Close</button>
          {inv.status !== 'paid' && inv.status !== 'cancelled' ? <button type="button" className="btn-primary" onClick={() => props.onPay(inv)}>Record payment</button> : null}
        </>
      }>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusPill status={inv.status} />
        <span className="text-xs text-slate-500">Issued {fmt.date(inv.issueDate)} · Due {fmt.date(inv.dueDate)} · {inv.term}</span>
      </div>
      <table className="mt-3 w-full text-sm">
        <thead><tr className="table-head"><th className="px-2 py-2 text-left">Item</th><th className="px-2 py-2 text-right">Amount</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {inv.items.map((it) => <tr key={it.id}><td className="px-2 py-2">{it.label}</td><td className="px-2 py-2 text-right">{money(it.amount)}</td></tr>)}
          <tr><td className="px-2 py-1 text-slate-500">Subtotal</td><td className="px-2 py-1 text-right">{money(subtotal)}</td></tr>
          <tr><td className="px-2 py-1 text-slate-500">Discount</td><td className="px-2 py-1 text-right">− {money(inv.discount)}</td></tr>
          <tr><td className="px-2 py-1 text-slate-500">Fine</td><td className="px-2 py-1 text-right">+ {money(inv.fine)}</td></tr>
          <tr className="font-extrabold"><td className="px-2 py-1">Total</td><td className="px-2 py-1 text-right">{money(inv.total)}</td></tr>
          <tr><td className="px-2 py-1 text-emerald-700">Paid</td><td className="px-2 py-1 text-right text-emerald-700">{money(inv.paid)}</td></tr>
          <tr className="font-extrabold"><td className="px-2 py-1">Balance</td><td className="px-2 py-1 text-right">{money(invoiceBalance(inv))}</td></tr>
        </tbody>
      </table>
      <h4 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Payments ({pays.length})</h4>
      <ul className="divide-y divide-slate-100">
        {pays.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-1.5 text-sm">
            <span>{p.receiptNo} <span className="text-xs text-slate-400">· {fmt.date(p.paymentDate)} · {p.method}</span></span>
            <span className="flex items-center gap-2 font-bold text-emerald-700">{money(p.amount)}
              <button type="button" className="btn-ghost !px-1.5 !py-0.5 text-xs" onClick={() => navigate(`/print/receipt/${p.id}`)}><Printer className="h-3.5 w-3.5" /></button>
            </span>
          </li>
        ))}
        {pays.length === 0 ? <li className="py-2 text-sm text-slate-400">No payments yet.</li> : null}
      </ul>
    </Modal>
  );
}

/* --------------------------------- payments --------------------------------- */

function PaymentsTab(props: { onPay: (inv: Invoice) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const update = useDB((s) => s.update);
  const money = useMoney();
  const fmt = useFmt();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [pickOpen, setPickOpen] = useState(false);

  const filtered = useMemo(
    () => [...snap.payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
      .filter((p) => (!method || p.method === method) && matchesQuery(q, p.receiptNo, p.reference, studentName(snap.students.find((s) => s.id === p.studentId)))),
    [snap, q, method],
  );

  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <SearchInput value={q} onChange={setQ} placeholder="Receipt no, student, reference…" className="lg:col-span-2" />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
          <option value="">All methods</option>{METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button
          type="button" className="btn-secondary"
          onClick={() => {
            exportCSV('payments', ['Receipt', 'Student', 'Invoice', 'Date', 'Method', 'Amount'],
              filtered.map((x) => [x.receiptNo, studentName(snap.students.find((y) => y.id === x.studentId)), snap.invoices.find((i) => i.id === x.invoiceId)?.invoiceNo ?? '', fmt.date(x.paymentDate), x.method, x.amount]));
            toast.success('Payments exported');
          }}
        >
          Export
        </button>
        <button type="button" className="btn-primary" onClick={() => setPickOpen(true)}><Plus className="h-4 w-4" /> Record payment</button>
      </div>
      <DataTable
        columns={[
          { key: 'rcpt', header: 'Receipt', render: (p: Payment) => <span className="font-semibold">{p.receiptNo}<span className="block text-xs font-normal text-slate-400">{fmt.date(p.paymentDate)}</span></span>, sortValue: (p) => p.receiptNo },
          { key: 'student', header: 'Student', render: (p: Payment) => <Link to={`/students/${p.studentId}`} className="link">{studentName(snap.students.find((s) => s.id === p.studentId))}</Link> },
          { key: 'invoice', header: 'Invoice', render: (p: Payment) => snap.invoices.find((i) => i.id === p.invoiceId)?.invoiceNo ?? '—' },
          { key: 'method', header: 'Method', render: (p: Payment) => <Badge tone="slate">{METHODS.find((m) => m.id === p.method)?.label ?? p.method}</Badge> },
          { key: 'amount', header: 'Amount', render: (p: Payment) => <span className="font-bold text-emerald-700">{money(p.amount)}</span>, sortValue: (p) => p.amount },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (p: Payment) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => navigate(`/print/receipt/${p.id}`)}><Printer className="h-3.5 w-3.5" /></button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(p)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={filtered}
        keyOf={(p) => p.id}
        emptyTitle="No payments found"
      />
      <PickInvoiceModal open={pickOpen} onClose={() => setPickOpen(false)} onPick={(inv) => { setPickOpen(false); props.onPay(inv); }} />
      <ConfirmDialog
        open={!!deleting} title={`Void ${deleting?.receiptNo}?`}
        message="The payment will be removed and the invoice balance restored. This is recorded only by the updated balance."
        confirmLabel="Void payment"
        onConfirm={() => {
          if (deleting) {
            const inv = snap.invoices.find((i) => i.id === deleting.invoiceId);
            remove('payments', deleting.id);
            if (inv) {
              const paid = Math.max(0, inv.paid - deleting.amount);
              update('invoices', inv.id, { paid, status: paid >= inv.total ? 'paid' : paid > 0 ? 'partial' : inv.dueDate < todayISO() ? 'overdue' : 'unpaid' });
            }
            toast.success('Payment voided');
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function PickInvoiceModal(props: { open: boolean; onClose: () => void; onPick: (inv: Invoice) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const money = useMoney();
  const [q, setQ] = useState('');
  if (!props.open) return <></>;
  const open = snap.invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && matchesQuery(q, i.invoiceNo, studentName(snap.students.find((s) => s.id === i.studentId))));
  return (
    <Modal open onClose={props.onClose} title="Select invoice to pay" size="lg">
      <SearchInput value={q} onChange={setQ} placeholder="Invoice no or student…" />
      <ul className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {open.map((i) => (
          <li key={i.id}>
            <button type="button" className="flex w-full items-center justify-between px-2 py-2 text-left hover:bg-slate-50" onClick={() => props.onPick(i)}>
              <span><span className="font-semibold">{i.invoiceNo}</span> <span className="text-sm text-slate-500">· {studentName(snap.students.find((s) => s.id === i.studentId))}</span></span>
              <span className="font-bold text-amber-700">{money(invoiceBalance(i))}</span>
            </button>
          </li>
        ))}
        {open.length === 0 ? <li className="py-6 text-center text-sm text-slate-400">No outstanding invoices.</li> : null}
      </ul>
    </Modal>
  );
}

export function PaymentModal(props: { invoice: Invoice | null; onClose: () => void; onDone: (inv: Invoice) => void }): React.JSX.Element {
  const record = useDB((s) => s.recordPayment);
  const school = useDB((s) => s.school);
  const money = useMoney();
  const navigate = useNavigate();
  const methods = METHODS.filter((m) => (school.enabledPaymentMethods ?? METHODS.map((x) => x.id)).includes(m.id));
  const [f, setF] = useState({ amount: '', paymentDate: todayISO(), method: 'cash' as PaymentMethod, reference: '', notes: '' });
  const [error, setError] = useState('');
  if (!props.invoice) return <></>;
  const inv = props.invoice;
  const balance = invoiceBalance(inv);

  const save = (print: boolean): void => {
    const amount = Number(f.amount);
    if (!(amount > 0)) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (amount > balance + 0.001) {
      setError(`Amount exceeds the outstanding balance of ${money(balance)}`);
      return;
    }
    const method = methods.some((m) => m.id === f.method) ? f.method : (methods[0]?.id ?? 'cash');
    try {
      const id = record({ invoiceId: inv.id, amount, paymentDate: f.paymentDate, method, reference: f.reference.trim() || undefined, notes: f.notes.trim() || undefined });
      toast.success(`Payment of ${money(amount)} recorded`);
      props.onDone(inv);
      if (print) navigate(`/print/receipt/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record payment');
    }
  };

  return (
    <Modal open onClose={props.onClose} title={`Record payment — ${inv.invoiceNo}`} subtitle={`Balance due: ${money(balance)}`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button>
          <button type="button" className="btn-secondary" onClick={() => save(true)}><Printer className="h-4 w-4" /> Save & print</button>
          <button type="button" className="btn-primary" onClick={() => save(false)}>Save payment</button>
        </>
      }>
      {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount">
          <div className="flex gap-2">
            <input type="number" min={0} step="0.01" className="input" value={f.amount} onChange={(e) => { setF({ ...f, amount: e.target.value }); setError(''); }} placeholder={String(balance)} />
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setF({ ...f, amount: String(balance) })}>Full</button>
          </div>
        </Field>
        <Field label="Payment date"><input type="date" className="input" value={f.paymentDate} max={todayISO()} onChange={(e) => setF({ ...f, paymentDate: e.target.value })} /></Field>
        <Field label="Method">
          <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentMethod })}>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Reference" optional><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Txn / cheque no" /></Field>
        <Field label="Notes" optional className="sm:col-span-2"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* -------------------------------- fee types --------------------------------- */

const FREQS: { id: FeeFrequency; label: string }[] = [
  { id: 'one-time', label: 'One-time' }, { id: 'monthly', label: 'Monthly' }, { id: 'term', label: 'Per term' },
  { id: 'yearly', label: 'Yearly' }, { id: 'custom', label: 'Custom' },
];

function FeeTypesTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const remove = useDB((s) => s.remove);
  const money = useMoney();
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: FeeType } | null>(null);
  const [f, setF] = useState({ name: '', code: '', description: '', defaultAmount: '', frequency: 'term' as FeeFrequency });
  const [deleting, setDeleting] = useState<FeeType | null>(null);

  const open = (mode: 'add' | 'edit', row?: FeeType): void => {
    setF({ name: row?.name ?? '', code: row?.code ?? '', description: row?.description ?? '', defaultAmount: row ? String(row.defaultAmount) : '', frequency: row?.frequency ?? 'term' });
    setModal({ mode, row });
  };
  const save = (): void => {
    if (!f.name.trim() || !f.code.trim()) {
      toast.error('Name and code are required');
      return;
    }
    const payload = { name: f.name.trim(), code: f.code.trim().toUpperCase(), description: f.description.trim() || undefined, defaultAmount: Number(f.defaultAmount) || 0, frequency: f.frequency };
    if (modal?.row) {
      update('feeTypes', modal.row.id, payload);
      toast.success('Fee type updated');
    } else {
      create('feeTypes', payload);
      toast.success('Fee type created');
    }
    setModal(null);
  };

  return (
    <div>
      <div className="flex justify-end p-3"><button type="button" className="btn-primary" onClick={() => open('add')}><Plus className="h-4 w-4" /> Add fee type</button></div>
      <DataTable
        columns={[
          { key: 'code', header: 'Code', render: (t: FeeType) => <span className="font-mono text-xs font-bold">{t.code}</span>, sortValue: (t) => t.code },
          { key: 'name', header: 'Name', render: (t: FeeType) => <span className="font-semibold">{t.name}</span>, sortValue: (t) => t.name },
          { key: 'freq', header: 'Frequency', render: (t: FeeType) => <Badge tone="slate">{FREQS.find((x) => x.id === t.frequency)?.label}</Badge> },
          { key: 'amount', header: 'Default amount', render: (t: FeeType) => money(t.defaultAmount), sortValue: (t) => t.defaultAmount },
          { key: 'desc', header: 'Description', render: (t: FeeType) => <span className="text-xs text-slate-500">{t.description ?? '—'}</span> },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (t: FeeType) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => open('edit', t)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(t)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={snap.feeTypes}
        keyOf={(t) => t.id}
        emptyTitle="No fee types"
      />
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit fee type' : 'Add fee type'}
        footer={<><button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Tuition Fee" /></Field>
          <Field label="Code"><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="TUI" /></Field>
          <Field label="Frequency">
            <select className="input" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as FeeFrequency })}>
              {FREQS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Default amount"><input type="number" min={0} className="input" value={f.defaultAmount} onChange={(e) => setF({ ...f, defaultAmount: e.target.value })} /></Field>
          <Field label="Description" optional className="sm:col-span-2"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleting} title={`Delete ${deleting?.name}?`} message="Structures referencing this type will keep their amounts but lose the link." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('feeTypes', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/* -------------------------------- structures -------------------------------- */

function StructuresTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const remove = useDB((s) => s.remove);
  const money = useMoney();
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: FeeStructure } | null>(null);
  const [f, setF] = useState({ name: '', classId: '', discountPercent: '', finePerDay: '', items: [] as { feeTypeId: string; amount: number }[] });
  const [deleting, setDeleting] = useState<FeeStructure | null>(null);

  const open = (mode: 'add' | 'edit', row?: FeeStructure): void => {
    setF({
      name: row?.name ?? '', classId: row?.classId ?? '',
      discountPercent: row?.discountPercent !== undefined ? String(row.discountPercent) : '',
      finePerDay: row?.finePerDay !== undefined ? String(row.finePerDay) : '',
      items: row ? row.items.map((i) => ({ ...i })) : [],
    });
    setModal({ mode, row });
  };
  const save = (): void => {
    if (!f.name.trim()) {
      toast.error('Structure name is required');
      return;
    }
    if (!f.items.length) {
      toast.error('Add at least one fee item');
      return;
    }
    const payload = {
      name: f.name.trim(), academicYearId: modal?.row?.academicYearId ?? snap.academicYears.find((y) => y.isCurrent)?.id ?? '',
      classId: f.classId || undefined, items: f.items,
      discountPercent: f.discountPercent === '' ? undefined : Number(f.discountPercent),
      finePerDay: f.finePerDay === '' ? undefined : Number(f.finePerDay),
    };
    if (modal?.row) {
      update('feeStructures', modal.row.id, payload);
      toast.success('Structure updated');
    } else {
      create('feeStructures', payload);
      toast.success('Structure created');
    }
    setModal(null);
  };
  const total = f.items.reduce((a, i) => a + i.amount, 0);

  return (
    <div>
      <div className="flex justify-end p-3"><button type="button" className="btn-primary" onClick={() => open('add')}><Plus className="h-4 w-4" /> New structure</button></div>
      <div className="grid gap-3 p-3 pt-0 lg:grid-cols-2">
        {snap.feeStructures.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-slate-500">{s.classId ? snap.classes.find((c) => c.id === s.classId)?.name : 'All classes'}{s.discountPercent ? ` · ${s.discountPercent}% discount` : ''}{s.finePerDay ? ` · fine ${money(s.finePerDay)}/day` : ''}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => open('edit', s)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(s)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {s.items.map((it, i) => (
                <li key={i} className="flex justify-between"><span className="text-slate-600">{snap.feeTypes.find((x) => x.id === it.feeTypeId)?.name ?? 'Fee'}</span><span className="font-semibold">{money(it.amount)}</span></li>
              ))}
              <li className="flex justify-between border-t border-slate-100 pt-1 font-bold"><span>Total</span><span>{money(s.items.reduce((a, i) => a + i.amount, 0))}</span></li>
            </ul>
          </div>
        ))}
        {snap.feeStructures.length === 0 ? <p className="col-span-2 py-8 text-center text-sm text-slate-400">No fee structures yet.</p> : null}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit structure' : 'New structure'} size="lg"
        footer={<><button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Grade 1 — Term 1" /></Field>
          <Field label="Applies to" optional>
            <select className="input" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
              <option value="">All classes</option>{snap.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Discount %" optional><input type="number" min={0} max={100} className="input" value={f.discountPercent} onChange={(e) => setF({ ...f, discountPercent: e.target.value })} /></Field>
          <Field label="Fine / day" optional><input type="number" min={0} className="input" value={f.finePerDay} onChange={(e) => setF({ ...f, finePerDay: e.target.value })} /></Field>
        </div>
        <div className="mb-2 mt-4 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items · total {money(total)}</h4>
          <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => snap.feeTypes[0] && setF({ ...f, items: [...f.items, { feeTypeId: snap.feeTypes[0].id, amount: snap.feeTypes[0].defaultAmount }] })}><Plus className="h-3.5 w-3.5" /> Add item</button>
        </div>
        <div className="space-y-2">
          {f.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_32px] gap-2">
              <select className="input" value={it.feeTypeId} onChange={(e) => setF({ ...f, items: f.items.map((x, idx) => (idx === i ? { ...x, feeTypeId: e.target.value } : x)) })}>
                {snap.feeTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
              </select>
              <input type="number" min={0} className="input" value={it.amount} onChange={(e) => setF({ ...f, items: f.items.map((x, idx) => (idx === i ? { ...x, amount: Number(e.target.value) || 0 } : x)) })} />
              <button type="button" className="btn-ghost !px-2 text-red-600" onClick={() => setF({ ...f, items: f.items.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Modal>
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} message="Existing invoices are unaffected." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('feeStructures', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}
