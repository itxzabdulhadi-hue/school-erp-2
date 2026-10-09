import { useMemo, useState } from 'react';
import { Boxes, Download, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import type { InventoryCategory, InventoryItem, InventoryTxn, InventoryTxnType } from '../../lib/db/types';
import { useFmt, useMoney } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { exportCSV, matchesQuery, todayISO } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatCard, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

type TabId = 'items' | 'movements';

const CATS: { id: InventoryCategory; label: string }[] = [
  { id: 'computers', label: 'Computers' }, { id: 'furniture', label: 'Furniture' }, { id: 'lab', label: 'Laboratory' },
  { id: 'sports', label: 'Sports' }, { id: 'stationery', label: 'Stationery' }, { id: 'books', label: 'Books' }, { id: 'other', label: 'Other' },
];
const TXN_TYPES: { id: InventoryTxnType; label: string }[] = [
  { id: 'purchase', label: 'Purchase (+)' }, { id: 'issue', label: 'Issue (−)' }, { id: 'return', label: 'Return (+)' },
  { id: 'transfer', label: 'Transfer' }, { id: 'disposal', label: 'Disposal (−)' },
];

export function InventoryPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const money = useMoney();
  const [tab, setTab] = useState<TabId>('items');
  const [itemModal, setItemModal] = useState<{ mode: 'add' | 'edit'; row?: InventoryItem } | null>(null);
  const [txnModal, setTxnModal] = useState<string | null>(null); // preset item id or 'new'

  const value = snap.inventory.reduce((a, i) => a + i.quantity * (i.purchaseCost ?? 0), 0);
  const low = snap.inventory.filter((i) => i.quantity <= i.minStock).length;

  return (
    <div>
      <PageHeader
        title="Inventory & Assets"
        subtitle="Stock, assets and movements"
        actions={
          tab === 'items'
            ? <button type="button" className="btn-primary" onClick={() => setItemModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add item</button>
            : <button type="button" className="btn-primary" onClick={() => setTxnModal('new')}><Plus className="h-4 w-4" /> Record movement</button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Boxes} label="Tracked items" value={String(snap.inventory.length)} tone="bg-blue-100 text-blue-700" />
        <StatCard icon={Boxes} label="Units in stock" value={String(snap.inventory.reduce((a, i) => a + i.quantity, 0))} tone="bg-emerald-100 text-emerald-700" />
        <StatCard icon={Boxes} label="Low stock alerts" value={String(low)} tone="bg-amber-100 text-amber-700" />
        <StatCard icon={Boxes} label="Stock value" value={money(value)} tone="bg-violet-100 text-violet-700" />
      </div>
      <Card>
        <div className="p-3">
          <Tabs<TabId> active={tab} onChange={setTab} tabs={[{ id: 'items', label: 'Items', count: snap.inventory.length }, { id: 'movements', label: 'Movements', count: snap.inventoryTxns.length }]} />
        </div>
        {tab === 'items' ? <ItemsTab onEdit={(row) => setItemModal({ mode: 'edit', row })} onMove={(id) => setTxnModal(id)} /> : null}
        {tab === 'movements' ? <MovementsTab /> : null}
      </Card>
      <ItemModal key={itemModal ? `${itemModal.mode}-${itemModal.row?.id ?? "new"}` : "closed"} modal={itemModal} onClose={() => setItemModal(null)} />
      <TxnModal key={txnModal ?? 'closed'} preset={txnModal} onClose={() => setTxnModal(null)} />
    </div>
  );
}

function ItemsTab(props: { onEdit: (i: InventoryItem) => void; onMove: (id: string) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const money = useMoney();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);

  const filtered = useMemo(
    () => snap.inventory.filter((i) => (!cat || i.category === cat) && matchesQuery(q, i.name, i.sku, i.location, i.supplier)),
    [snap, q, cat],
  );

  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search items…" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
          <option value="">All categories</option>{CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button
          type="button" className="btn-secondary"
          onClick={() => {
            exportCSV('inventory', ['Item', 'SKU', 'Category', 'Qty', 'Unit', 'Cost', 'Location', 'Condition'],
              filtered.map((i) => [i.name, i.sku ?? '', i.category, i.quantity, i.unit ?? '', i.purchaseCost ?? '', i.location ?? '', i.condition]));
            toast.success('Inventory exported');
          }}
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>
      <DataTable
        columns={[
          { key: 'name', header: 'Item', render: (i: InventoryItem) => <span className="font-semibold">{i.name}<span className="block text-xs font-normal text-slate-400">{i.sku ?? 'No SKU'} · {i.location ?? 'No location'}</span></span>, sortValue: (i) => i.name },
          { key: 'cat', header: 'Category', render: (i: InventoryItem) => <Badge tone="slate">{CATS.find((c) => c.id === i.category)?.label}</Badge> },
          { key: 'qty', header: 'Stock', render: (i: InventoryItem) => <span className={i.quantity <= i.minStock ? 'font-bold text-red-600' : 'font-bold'}>{i.quantity} {i.unit ?? ''}{i.quantity <= i.minStock ? ' · LOW' : ''}</span>, sortValue: (i) => i.quantity },
          { key: 'cost', header: 'Unit cost', render: (i: InventoryItem) => (i.purchaseCost ? money(i.purchaseCost) : '—') },
          { key: 'cond', header: 'Condition', render: (i: InventoryItem) => <span className="capitalize">{i.condition}</span> },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (i: InventoryItem) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => props.onMove(i.id)}>Move stock</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => props.onEdit(i)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(i)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={filtered}
        keyOf={(i) => i.id}
        emptyTitle="No items found"
      />
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} message="Movement history is preserved." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('inventory', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function ItemModal(props: { modal: { mode: 'add' | 'edit'; row?: InventoryItem } | null; onClose: () => void }): React.JSX.Element {
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    name: row?.name ?? '', sku: row?.sku ?? '', category: (row?.category ?? 'other') as InventoryCategory,
    quantity: String(row?.quantity ?? 0), unit: row?.unit ?? 'pcs', purchaseDate: row?.purchaseDate ?? '',
    purchaseCost: row?.purchaseCost !== undefined ? String(row.purchaseCost) : '', supplier: row?.supplier ?? '',
    location: row?.location ?? '', condition: row?.condition ?? 'good', department: row?.department ?? '',
    maintenanceStatus: row?.maintenanceStatus ?? '', minStock: String(row?.minStock ?? 0),
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.name)) e.name = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      name: f.name.trim(), sku: f.sku.trim() || undefined, category: f.category, quantity: Math.max(0, Number(f.quantity) || 0),
      unit: f.unit.trim() || undefined, purchaseDate: f.purchaseDate || undefined,
      purchaseCost: f.purchaseCost === '' ? undefined : Number(f.purchaseCost), supplier: f.supplier.trim() || undefined,
      location: f.location.trim() || undefined, condition: f.condition as InventoryItem['condition'],
      department: f.department.trim() || undefined, maintenanceStatus: f.maintenanceStatus.trim() || undefined,
      minStock: Number(f.minStock) || 0,
    };
    if (row) {
      update('inventory', row.id, payload);
      toast.success('Item updated');
    } else {
      create('inventory', { ...payload, createdAt: new Date().toISOString() });
      toast.success('Item added');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit item' : 'Add item'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Item name" error={errors.name} className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="SKU" optional><input className="input" value={f.sku} onChange={(e) => set({ sku: e.target.value })} /></Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => set({ category: e.target.value as InventoryCategory })}>
            {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Quantity"><input type="number" min={0} className="input" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} /></Field>
        <Field label="Unit" optional><input className="input" value={f.unit} onChange={(e) => set({ unit: e.target.value })} /></Field>
        <Field label="Purchase date" optional><input type="date" className="input" value={f.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} /></Field>
        <Field label="Unit cost" optional><input type="number" min={0} className="input" value={f.purchaseCost} onChange={(e) => set({ purchaseCost: e.target.value })} /></Field>
        <Field label="Supplier" optional><input className="input" value={f.supplier} onChange={(e) => set({ supplier: e.target.value })} /></Field>
        <Field label="Location" optional><input className="input" value={f.location} onChange={(e) => set({ location: e.target.value })} /></Field>
        <Field label="Condition">
          <select className="input capitalize" value={f.condition} onChange={(e) => set({ condition: e.target.value as InventoryItem['condition'] })}>
            {['new', 'good', 'fair', 'poor', 'damaged'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Min stock alert"><input type="number" min={0} className="input" value={f.minStock} onChange={(e) => set({ minStock: e.target.value })} /></Field>
        <Field label="Department" optional><input className="input" value={f.department} onChange={(e) => set({ department: e.target.value })} /></Field>
        <Field label="Maintenance" optional className="sm:col-span-2"><input className="input" value={f.maintenanceStatus} onChange={(e) => set({ maintenanceStatus: e.target.value })} placeholder="e.g. Service due in March" /></Field>
      </div>
    </Modal>
  );
}

function MovementsTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => [...snap.inventoryTxns].sort((a, b) => b.date.localeCompare(a.date))
      .filter((t) => matchesQuery(q, snap.inventory.find((i) => i.id === t.itemId)?.name, t.party, t.notes)),
    [snap, q],
  );
  return (
    <div>
      <div className="border-b border-slate-100 p-3"><SearchInput value={q} onChange={setQ} placeholder="Search movements…" className="sm:w-72" /></div>
      <DataTable
        columns={[
          { key: 'date', header: 'Date', render: (t: InventoryTxn) => fmt.date(t.date), sortValue: (t) => t.date },
          { key: 'item', header: 'Item', render: (t: InventoryTxn) => snap.inventory.find((i) => i.id === t.itemId)?.name ?? '—' },
          { key: 'type', header: 'Type', render: (t: InventoryTxn) => <Badge tone={t.type === 'purchase' || t.type === 'return' ? 'green' : t.type === 'transfer' ? 'blue' : 'amber'}>{TXN_TYPES.find((x) => x.id === t.type)?.label ?? t.type}</Badge> },
          { key: 'qty', header: 'Qty', render: (t: InventoryTxn) => t.quantity, sortValue: (t) => t.quantity },
          { key: 'party', header: 'Party', render: (t: InventoryTxn) => t.party ?? '—' },
          { key: 'notes', header: 'Notes', render: (t: InventoryTxn) => <span className="text-xs text-slate-500">{t.notes ?? '—'}</span> },
        ]}
        data={filtered}
        keyOf={(t) => t.id}
        emptyTitle="No movements yet"
      />
    </div>
  );
}

function TxnModal(props: { preset: string | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const add = useDB((s) => s.addInventoryTxn);
  const [f, setF] = useState({ itemId: props.preset && props.preset !== 'new' ? props.preset : '', type: 'purchase' as InventoryTxnType, quantity: '1', date: todayISO(), party: '', notes: '' });
  if (!props.preset) return <></>;
  return (
    <Modal open onClose={props.onClose} title="Record stock movement" subtitle="Item quantity updates automatically"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button
        type="button" className="btn-primary" disabled={!f.itemId || !(Number(f.quantity) > 0)}
        onClick={() => {
          add({ itemId: f.itemId, type: f.type, quantity: Number(f.quantity), date: f.date, party: f.party.trim() || undefined, notes: f.notes.trim() || undefined });
          toast.success('Movement recorded');
          props.onClose();
        }}
      >Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Item" className="sm:col-span-2">
          <select className="input" value={f.itemId} onChange={(e) => setF({ ...f, itemId: e.target.value })}>
            <option value="">Select…</option>{snap.inventory.map((i) => <option key={i.id} value={i.id}>{i.name} (stock {i.quantity})</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as InventoryTxnType })}>
            {TXN_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Quantity"><input type="number" min={1} className="input" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
        <Field label="Date"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Party" optional><input className="input" value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} placeholder="Supplier / department" /></Field>
        <Field label="Notes" optional className="sm:col-span-2"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
