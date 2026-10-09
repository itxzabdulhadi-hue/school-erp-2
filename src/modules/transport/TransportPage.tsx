import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { classLabel, studentName } from '../../lib/db/selectors';
import type { Driver, Route, Student, Vehicle } from '../../lib/db/types';
import { useFmt, useMoney } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { matchesQuery, uid } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatusPill, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

type TabId = 'routes' | 'vehicles' | 'drivers' | 'students';

export function TransportPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const [tab, setTab] = useState<TabId>('routes');
  const [routeModal, setRouteModal] = useState<{ mode: 'add' | 'edit'; row?: Route } | null>(null);
  const [vehicleModal, setVehicleModal] = useState<{ mode: 'add' | 'edit'; row?: Vehicle } | null>(null);
  const [driverModal, setDriverModal] = useState<{ mode: 'add' | 'edit'; row?: Driver } | null>(null);

  return (
    <div>
      <PageHeader
        title="Transport"
        subtitle="Routes, fleet, drivers and student assignments · GPS-ready"
        actions={
          tab === 'routes' ? <button type="button" className="btn-primary" onClick={() => setRouteModal({ mode: 'add' })}><Plus className="h-4 w-4" /> New route</button>
          : tab === 'vehicles' ? <button type="button" className="btn-primary" onClick={() => setVehicleModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add vehicle</button>
          : tab === 'drivers' ? <button type="button" className="btn-primary" onClick={() => setDriverModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add driver</button>
          : undefined
        }
      />
      <Card>
        <div className="p-3">
          <Tabs<TabId>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'routes', label: 'Routes', count: snap.routes.length },
              { id: 'vehicles', label: 'Vehicles', count: snap.vehicles.length },
              { id: 'drivers', label: 'Drivers', count: snap.drivers.length },
              { id: 'students', label: 'Student assignments', count: snap.students.filter((s) => s.routeId).length },
            ]}
          />
        </div>
        {tab === 'routes' ? <RoutesTab onEdit={(row) => setRouteModal({ mode: 'edit', row })} /> : null}
        {tab === 'vehicles' ? <VehiclesTab onEdit={(row) => setVehicleModal({ mode: 'edit', row })} /> : null}
        {tab === 'drivers' ? <DriversTab onEdit={(row) => setDriverModal({ mode: 'edit', row })} /> : null}
        {tab === 'students' ? <AssignmentsTab /> : null}
      </Card>
      <RouteModal key={routeModal ? `${routeModal.mode}-${routeModal.row?.id ?? "new"}` : "closed"} modal={routeModal} onClose={() => setRouteModal(null)} />
      <VehicleModal key={vehicleModal ? `${vehicleModal.mode}-${vehicleModal.row?.id ?? "new"}` : "closed"} modal={vehicleModal} onClose={() => setVehicleModal(null)} />
      <DriverModal key={driverModal ? `${driverModal.mode}-${driverModal.row?.id ?? "new"}` : "closed"} modal={driverModal} onClose={() => setDriverModal(null)} />
    </div>
  );
}

/* ---------------------------------- routes ---------------------------------- */

function RoutesTab(props: { onEdit: (r: Route) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const money = useMoney();
  const [deleting, setDeleting] = useState<Route | null>(null);

  return (
    <div className="grid gap-3 p-3 pt-0 lg:grid-cols-2">
      {snap.routes.map((r) => {
        const students = snap.students.filter((s) => s.routeId === r.id && s.status === 'active');
        const vehicle = snap.vehicles.find((v) => v.id === r.vehicleId);
        const driver = snap.drivers.find((d) => d.id === r.driverId);
        return (
          <div key={r.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Bus className="h-5 w-5" /></span>
                <div>
                  <p className="font-bold">{r.name} <span className="text-xs font-normal text-slate-400">{r.code}</span></p>
                  <p className="text-xs text-slate-500">{r.pickupTime} → {r.dropTime} · {money(r.fare)}/mo · {students.length} students</p>
                </div>
              </div>
              <div className="flex gap-1">
                <StatusPill status={r.status} />
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => props.onEdit(r)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {[vehicle ? `Vehicle: ${vehicle.vehicleNo}` : '', driver ? `Driver: ${driver.name}` : ''].filter(Boolean).join(' · ') || 'No vehicle/driver linked'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {[...r.stops].sort((a, b) => a.order - b.order).map((s, i, arr) => (
                <span key={s.id} className="flex items-center gap-1 text-xs">
                  <Badge tone="slate">{s.name}{s.pickupTime ? ` ${s.pickupTime}` : ''}</Badge>
                  {i < arr.length - 1 ? <span className="text-slate-300">→</span> : null}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {snap.routes.length === 0 ? <p className="col-span-2 py-8 text-center text-sm text-slate-400">No routes yet.</p> : null}
      <ConfirmDialog
        open={!!deleting} title={`Delete ${deleting?.name}?`} message="Students on this route will be unassigned from transport." confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) {
            snap.students.filter((s) => s.routeId === deleting.id).forEach((s) => useDB.getState().update('students', s.id, { routeId: undefined, pickupPoint: undefined, dropPoint: undefined }));
            remove('routes', deleting.id);
            toast.success('Route deleted');
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function RouteModal(props: { modal: { mode: 'add' | 'edit'; row?: Route } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    name: row?.name ?? '', code: row?.code ?? '', driverId: row?.driverId ?? '', vehicleId: row?.vehicleId ?? '',
    pickupTime: row?.pickupTime ?? '07:15', dropTime: row?.dropTime ?? '15:45', fare: String(row?.fare ?? 80),
    status: (row?.status ?? 'active') as Route['status'],
    stops: row ? [...row.stops].sort((a, b) => a.order - b.order).map((s) => ({ name: s.name, pickupTime: s.pickupTime ?? '' })) : [{ name: '', pickupTime: '' }],
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));

  const save = (): void => {
    const e: Errors = {};
    if (required(f.name)) e.name = 'Required';
    if (required(f.code)) e.code = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const id = row?.id ?? uid('rte');
    const stops = f.stops.filter((s) => s.name.trim()).map((s, i) => ({ id: uid(`stp${i}`), routeId: id, name: s.name.trim(), pickupTime: s.pickupTime || undefined, order: i + 1 }));
    const payload = {
      name: f.name.trim(), code: f.code.trim().toUpperCase(), driverId: f.driverId || undefined,
      vehicleId: f.vehicleId || undefined, pickupTime: f.pickupTime || undefined, dropTime: f.dropTime || undefined,
      fare: Number(f.fare) || 0, status: f.status, stops,
    };
    if (row) {
      update('routes', row.id, payload);
      toast.success('Route updated');
    } else {
      create('routes', { ...payload, id });
      toast.success('Route created');
    }
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit route' : 'New route'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Route name" error={errors.name}><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="North Loop" /></Field>
        <Field label="Code" error={errors.code}><input className="input" value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="RT-01" /></Field>
        <Field label="Vehicle" optional>
          <select className="input" value={f.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })}>
            <option value="">—</option>{snap.vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo} ({v.type})</option>)}
          </select>
        </Field>
        <Field label="Driver" optional>
          <select className="input" value={f.driverId} onChange={(e) => set({ driverId: e.target.value })}>
            <option value="">—</option>{snap.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Pickup time"><input type="time" className="input" value={f.pickupTime} onChange={(e) => set({ pickupTime: e.target.value })} /></Field>
        <Field label="Drop time"><input type="time" className="input" value={f.dropTime} onChange={(e) => set({ dropTime: e.target.value })} /></Field>
        <Field label="Monthly fare"><input type="number" min={0} className="input" value={f.fare} onChange={(e) => set({ fare: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value as Route['status'] })}>
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </Field>
      </div>
      <div className="mb-2 mt-4 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Stops (in order)</h4>
        <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => set({ stops: [...f.stops, { name: '', pickupTime: '' }] })}><Plus className="h-3.5 w-3.5" /> Add stop</button>
      </div>
      <div className="space-y-2">
        {f.stops.map((s, i) => (
          <div key={i} className="grid grid-cols-[24px_1fr_130px_32px] items-center gap-2">
            <span className="text-center text-xs font-bold text-slate-400">{i + 1}</span>
            <input className="input" value={s.name} onChange={(e) => set({ stops: f.stops.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)) })} placeholder="Stop name" />
            <input type="time" className="input" value={s.pickupTime} onChange={(e) => set({ stops: f.stops.map((x, idx) => (idx === i ? { ...x, pickupTime: e.target.value } : x)) })} />
            <button type="button" className="btn-ghost !px-2 text-red-600" onClick={() => set({ stops: f.stops.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* --------------------------------- vehicles --------------------------------- */

function VehiclesTab(props: { onEdit: (v: Vehicle) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  return (
    <div>
      <DataTable
        columns={[
          { key: 'no', header: 'Vehicle', render: (v: Vehicle) => <span className="font-bold">{v.vehicleNo}<span className="block text-xs font-normal text-slate-400">{v.registrationNo}</span></span>, sortValue: (v) => v.vehicleNo },
          { key: 'type', header: 'Type', render: (v: Vehicle) => v.type },
          { key: 'cap', header: 'Capacity', render: (v: Vehicle) => v.capacity },
          { key: 'driver', header: 'Driver', render: (v: Vehicle) => snap.drivers.find((d) => d.id === v.driverId)?.name ?? '—' },
          { key: 'route', header: 'Route', render: (v: Vehicle) => snap.routes.find((r) => r.vehicleId === v.id)?.name ?? '—' },
          { key: 'gps', header: 'GPS', render: (v: Vehicle) => v.gpsDeviceId ? <Badge tone="green">{v.gpsDeviceId}</Badge> : <Badge tone="slate">Not fitted</Badge> },
          { key: 'status', header: 'Status', render: (v: Vehicle) => <StatusPill status={v.status} /> },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (v: Vehicle) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => props.onEdit(v)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(v)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={snap.vehicles}
        keyOf={(v) => v.id}
        emptyTitle="No vehicles yet"
      />
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.vehicleNo}?`} message="The vehicle will be removed from the fleet." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('vehicles', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function VehicleModal(props: { modal: { mode: 'add' | 'edit'; row?: Vehicle } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    vehicleNo: row?.vehicleNo ?? '', registrationNo: row?.registrationNo ?? '', type: row?.type ?? 'Bus',
    capacity: String(row?.capacity ?? 40), driverId: row?.driverId ?? '', routeId: row?.routeId ?? '',
    status: (row?.status ?? 'active') as Vehicle['status'], gpsDeviceId: row?.gpsDeviceId ?? '', notes: row?.notes ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.vehicleNo)) e.vehicleNo = 'Required';
    if (required(f.registrationNo)) e.registrationNo = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      vehicleNo: f.vehicleNo.trim().toUpperCase(), registrationNo: f.registrationNo.trim().toUpperCase(), type: f.type,
      capacity: Number(f.capacity) || 0, driverId: f.driverId || undefined, routeId: f.routeId || undefined,
      status: f.status, gpsDeviceId: f.gpsDeviceId.trim() || undefined, notes: f.notes.trim() || undefined,
    };
    if (row) {
      update('vehicles', row.id, payload);
      toast.success('Vehicle updated');
    } else {
      create('vehicles', payload);
      toast.success('Vehicle added');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit vehicle' : 'Add vehicle'}
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vehicle no" error={errors.vehicleNo}><input className="input" value={f.vehicleNo} onChange={(e) => set({ vehicleNo: e.target.value })} placeholder="BUS-01" /></Field>
        <Field label="Registration no" error={errors.registrationNo}><input className="input" value={f.registrationNo} onChange={(e) => set({ registrationNo: e.target.value })} /></Field>
        <Field label="Type">
          <select className="input" value={f.type} onChange={(e) => set({ type: e.target.value })}>
            {['Bus', 'Van', 'Coaster', 'Car', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Capacity"><input type="number" min={1} className="input" value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} /></Field>
        <Field label="Driver" optional>
          <select className="input" value={f.driverId} onChange={(e) => set({ driverId: e.target.value })}>
            <option value="">—</option>{snap.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Route" optional>
          <select className="input" value={f.routeId} onChange={(e) => set({ routeId: e.target.value })}>
            <option value="">—</option>{snap.routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="input capitalize" value={f.status} onChange={(e) => set({ status: e.target.value as Vehicle['status'] })}>
            <option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="GPS device ID" optional><input className="input" value={f.gpsDeviceId} onChange={(e) => set({ gpsDeviceId: e.target.value })} placeholder="For future tracking" /></Field>
        <Field label="Notes" optional className="sm:col-span-2"><input className="input" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* ---------------------------------- drivers ---------------------------------- */

function DriversTab(props: { onEdit: (d: Driver) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const fmt = useFmt();
  const [deleting, setDeleting] = useState<Driver | null>(null);
  return (
    <div>
      <DataTable
        columns={[
          { key: 'name', header: 'Driver', render: (d: Driver) => <span className="font-semibold">{d.name}<span className="block text-xs font-normal text-slate-400">{d.phone}</span></span>, sortValue: (d) => d.name },
          { key: 'license', header: 'License', render: (d: Driver) => <span>{d.licenseNo}<span className="block text-xs text-slate-400">{d.licenseExpiry ? `exp ${fmt.date(d.licenseExpiry)}` : 'no expiry set'}</span></span> },
          { key: 'vehicle', header: 'Vehicle', render: (d: Driver) => snap.vehicles.find((v) => v.id === d.vehicleId)?.vehicleNo ?? '—' },
          { key: 'route', header: 'Route', render: (d: Driver) => snap.routes.find((r) => r.driverId === d.id)?.name ?? '—' },
          { key: 'status', header: 'Status', render: (d: Driver) => <StatusPill status={d.status} /> },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (d: Driver) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => props.onEdit(d)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(d)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={snap.drivers}
        keyOf={(d) => d.id}
        emptyTitle="No drivers yet"
      />
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} message="The driver will be removed." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('drivers', deleting.id); toast.success('Deleted'); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}

function DriverModal(props: { modal: { mode: 'add' | 'edit'; row?: Driver } | null; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    name: row?.name ?? '', phone: row?.phone ?? '', licenseNo: row?.licenseNo ?? '', licenseExpiry: row?.licenseExpiry ?? '',
    vehicleId: row?.vehicleId ?? '', status: (row?.status ?? 'active') as Driver['status'],
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.name)) e.name = 'Required';
    if (required(f.phone)) e.phone = 'Required';
    if (required(f.licenseNo)) e.licenseNo = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = {
      name: f.name.trim(), phone: f.phone.trim(), licenseNo: f.licenseNo.trim(),
      licenseExpiry: f.licenseExpiry || undefined, vehicleId: f.vehicleId || undefined, status: f.status,
    };
    if (row) {
      update('drivers', row.id, payload);
      toast.success('Driver updated');
    } else {
      create('drivers', payload);
      toast.success('Driver added');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit driver' : 'Add driver'}
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" error={errors.name}><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Phone" error={errors.phone}><input className="input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="License no" error={errors.licenseNo}><input className="input" value={f.licenseNo} onChange={(e) => set({ licenseNo: e.target.value })} /></Field>
        <Field label="License expiry" optional><input type="date" className="input" value={f.licenseExpiry} onChange={(e) => set({ licenseExpiry: e.target.value })} /></Field>
        <Field label="Vehicle" optional>
          <select className="input" value={f.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })}>
            <option value="">—</option>{snap.vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value as Driver['status'] })}>
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/* -------------------------------- assignments -------------------------------- */

function AssignmentsTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const update = useDB((s) => s.update);
  const [q, setQ] = useState('');
  const [routeId, setRouteId] = useState('');
  const [editing, setEditing] = useState<Student | null>(null);
  const [f, setF] = useState({ routeId: '', pickupPoint: '', dropPoint: '' });

  const filtered = useMemo(
    () => snap.students.filter((s) => s.status === 'active' && (!routeId || (s.routeId ?? '') === routeId) && matchesQuery(q, studentName(s), s.studentId)),
    [snap, q, routeId],
  );
  const stops = snap.routes.find((r) => r.id === (editing ? f.routeId : ''))?.stops ?? [];

  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search students…" />
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="input">
          <option value="">All routes (incl. none)</option>
          <option value="__none">No transport</option>
          {snap.routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <DataTable
        columns={[
          { key: 'student', header: 'Student', render: (s: Student) => <Link to={`/students/${s.id}`} className="link">{studentName(s)}</Link>, sortValue: (s) => studentName(s) },
          { key: 'class', header: 'Class', render: (s: Student) => classLabel(snap, s.classId, s.sectionId) },
          { key: 'route', header: 'Route', render: (s: Student) => s.routeId ? snap.routes.find((r) => r.id === s.routeId)?.name ?? '—' : <Badge tone="slate">None</Badge> },
          { key: 'points', header: 'Pickup / Drop', render: (s: Student) => <span className="text-xs">{s.pickupPoint ?? '—'} → {s.dropPoint ?? '—'}</span> },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (s: Student) => <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => { setEditing(s); setF({ routeId: s.routeId ?? '', pickupPoint: s.pickupPoint ?? '', dropPoint: s.dropPoint ?? '' }); }}>Assign</button>,
          },
        ]}
        data={filtered.filter((s) => routeId !== '__none' || !s.routeId)}
        keyOf={(s) => s.id}
        emptyTitle="No students match"
      />
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Transport — ${studentName(editing)}` : 'Transport'}
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button
          type="button" className="btn-primary"
          onClick={() => {
            if (editing) {
              update('students', editing.id, { routeId: f.routeId || undefined, pickupPoint: f.pickupPoint || undefined, dropPoint: f.dropPoint || undefined });
              toast.success('Transport assignment saved');
            }
            setEditing(null);
          }}
        >Save</button></>}>
        <div className="grid gap-3">
          <Field label="Route" optional>
            <select className="input" value={f.routeId} onChange={(e) => setF({ routeId: e.target.value, pickupPoint: '', dropPoint: '' })}>
              <option value="">No transport</option>{snap.routes.filter((r) => r.status === 'active').map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pickup point" optional>
              <select className="input" value={f.pickupPoint} onChange={(e) => setF({ ...f, pickupPoint: e.target.value })}>
                <option value="">—</option>{stops.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Drop-off point" optional>
              <select className="input" value={f.dropPoint} onChange={(e) => setF({ ...f, dropPoint: e.target.value })}>
                <option value="">—</option>{stops.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
