import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { CURRENCIES } from '../../config/whitelabel';
import { useDB } from '../../lib/db/store';
import { useMoney, useSchool } from '../../lib/useSchool';
import { nowISO, todayISO } from '../../lib/utils';
import { ScalesTab } from '../results/ResultsPage';
import { SchoolLogo } from '../../components/branding/BrandingProvider';
import { Badge, Card, CardHeader, ConfirmDialog, Field, Modal, PageHeader, Tabs } from '../../components/ui/primitives';
import { toast } from '../../components/ui/toast';

type TabId = 'school' | 'academic' | 'finance' | 'system' | 'data';

export function SettingsPage(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('school');
  return (
    <div>
      <PageHeader title="Settings" subtitle="White-label branding, academic rules, finance and system preferences" />
      <Card>
        <div className="p-3">
          <Tabs<TabId>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'school', label: 'School & branding' },
              { id: 'academic', label: 'Academic' },
              { id: 'finance', label: 'Finance' },
              { id: 'system', label: 'System' },
              { id: 'data', label: 'Data' },
            ]}
          />
        </div>
        {tab === 'school' ? <SchoolTab /> : null}
        {tab === 'academic' ? <AcademicTab /> : null}
        {tab === 'finance' ? <FinanceTab /> : null}
        {tab === 'system' ? <SystemTab /> : null}
        {tab === 'data' ? <DataTab /> : null}
      </Card>
    </div>
  );
}

/* ------------------------------- school tab --------------------------------- */

function SchoolTab(): React.JSX.Element {
  const school = useSchool();
  const setSchool = useDB((s) => s.setSchool);
  const money = useMoney();
  const [f, setF] = useState({ ...school });
  const [dirty, setDirty] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const favRef = useRef<HTMLInputElement>(null);

  const set = (p: Partial<typeof f>): void => {
    setF((x) => ({ ...x, ...p }));
    setDirty(true);
  };

  const readImage = (file: File | undefined, apply: (dataUrl: string) => void): void => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 800 * 1024) {
      toast.error('Image too large — please use a file under 800 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        apply(reader.result);
        setDirty(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const save = (): void => {
    if (!f.name.trim()) {
      toast.error('School name is required');
      return;
    }
    setSchool({ ...f, name: f.name.trim() });
    setDirty(false);
    toast.success('Branding updated across the entire ERP');
  };

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Identity</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="School name"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Motto / tagline" optional><input className="input" value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} /></Field>
            <Field label="Principal / head" optional><input className="input" value={f.principalName} onChange={(e) => set({ principalName: e.target.value })} /></Field>
            <Field label="Registration no" optional><input className="input" value={f.registrationNo} onChange={(e) => set({ registrationNo: e.target.value })} /></Field>
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Logo & favicon</h4>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <SchoolLogo size={52} />
              <div>
                <p className="text-xs font-semibold">Current logo</p>
                <div className="mt-1 flex gap-2">
                  <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => logoRef.current?.click()}>Upload</button>
                  {f.logo ? <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => set({ logo: '' })}>Use crest</button> : null}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => readImage(e.target.files?.[0], (logo) => set({ logo }))} />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              {f.favicon ? <img src={f.favicon} alt="favicon" className="h-8 w-8 rounded" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-xs">?</span>}
              <div>
                <p className="text-xs font-semibold">Favicon</p>
                <div className="mt-1 flex gap-2">
                  <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => favRef.current?.click()}>Upload</button>
                  {f.favicon ? <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => set({ favicon: '' })}>Clear</button> : null}
                </div>
                <input ref={favRef} type="file" accept="image/*" className="hidden" onChange={(e) => readImage(e.target.files?.[0], (favicon) => set({ favicon }))} />
              </div>
            </div>
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Brand colors</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {([['primaryColor', 'Primary'], ['secondaryColor', 'Secondary'], ['accentColor', 'Accent']] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <div className="flex gap-2">
                  <input type="color" value={f[key]} onChange={(e) => set({ [key]: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
                  <input className="input font-mono" value={f[key]} onChange={(e) => set({ [key]: e.target.value })} />
                </div>
              </Field>
            ))}
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Contact & address</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address" optional><input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
            <Field label="City" optional><input className="input" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label="Country" optional><input className="input" value={f.country} onChange={(e) => set({ country: e.target.value })} /></Field>
            <Field label="Phone" optional><input className="input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field label="Email" optional><input className="input" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label="Website" optional><input className="input" value={f.website} onChange={(e) => set({ website: e.target.value })} /></Field>
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Locale & session</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Currency">
              <select
                className="input"
                value={f.currency}
                onChange={(e) => {
                  const c = CURRENCIES.find((x) => x.code === e.target.value);
                  if (c) set({ currency: c.code, currencySymbol: c.symbol });
                }}
              >
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </Field>
            <Field label="Currency symbol"><input className="input" value={f.currencySymbol} onChange={(e) => set({ currencySymbol: e.target.value })} /></Field>
            <Field label="Academic year"><input className="input" value={f.academicYear} onChange={(e) => set({ academicYear: e.target.value })} /></Field>
            <Field label="Current term"><input className="input" value={f.currentTerm} onChange={(e) => set({ currentTerm: e.target.value })} /></Field>
          </div>
        </section>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-primary" disabled={!dirty} onClick={save}>Save changes{dirty ? ' *' : ''}</button>
          {dirty ? <span className="text-xs text-amber-600">Unsaved changes</span> : <span className="text-xs text-slate-400">All changes saved</span>}
        </div>
      </div>
      <div>
        <div className="lg:sticky lg:top-20">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Live preview</h4>
          <div className="rounded-xl border border-slate-200 p-4" style={{ ['--brand-primary' as string]: f.primaryColor, ['--brand-secondary' as string]: f.secondaryColor, ['--brand-accent' as string]: f.accentColor }}>
            <div className="flex items-center gap-2.5 border-b-2 pb-3" style={{ borderColor: f.primaryColor }}>
              {f.logo ? <img src={f.logo} alt="logo" className="h-11 w-11 rounded-xl object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-extrabold text-white" style={{ backgroundColor: f.primaryColor }}>{(f.name[0] ?? 'S').toUpperCase()}</span>}
              <div>
                <p className="text-sm font-extrabold" style={{ color: f.secondaryColor }}>{f.name || 'School name'}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{f.tagline}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: f.primaryColor }}>Primary button</span>
              <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: f.accentColor }}>Accent</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Fees display as {money(1250)} · {f.city}{f.city && f.country ? ', ' : ''}{f.country}</p>
            <p className="mt-1 text-xs text-slate-500">{f.phone} · {f.email}</p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            The same build can serve another school via <code>VITE_SCHOOL_*</code> variables or by editing this page — no code changes needed.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- academic tab -------------------------------- */

function Toggle(props: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 p-3.5">
      <span><span className="block text-sm font-semibold">{props.label}</span><span className="block text-xs text-slate-500">{props.desc}</span></span>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--brand-primary)]" />
    </label>
  );
}

function AcademicTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const setSchool = useDB((s) => s.setSchool);
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const remove = useDB((s) => s.remove);
  const school = useSchool();
  const [yearModal, setYearModal] = useState(false);
  const [yf, setYf] = useState({ name: '', startDate: '', endDate: '', terms: 'Term 1, Term 2' });
  const currentYear = snap.academicYears.find((y) => y.isCurrent);

  const setCurrent = (id: string): void => {
    snap.academicYears.forEach((y) => update('academicYears', y.id, { isCurrent: y.id === id }));
    const y = snap.academicYears.find((x) => x.id === id);
    if (y) setSchool({ academicYear: y.name, currentTerm: y.terms[0] ?? school.currentTerm });
    toast.success('Academic year switched');
  };

  return (
    <div className="space-y-5 p-4">
      <section className="grid gap-3 md:grid-cols-3">
        <Toggle label="Religion field" desc="Show the optional religion field on student forms." checked={school.religionFieldEnabled} onChange={(v) => { setSchool({ religionFieldEnabled: v }); toast.success('Preference saved'); }} />
        <Toggle label="GPA display" desc="Show GPA alongside grades on results and report cards." checked={school.gpaEnabled} onChange={(v) => { setSchool({ gpaEnabled: v }); toast.success('Preference saved'); }} />
        <Toggle label="Subject-wise attendance" desc="Mark student attendance per subject instead of per day." checked={school.subjectWiseAttendance} onChange={(v) => { setSchool({ subjectWiseAttendance: v }); toast.success('Attendance mode updated'); }} />
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Academic years & terms</h4>
          <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setYearModal(true)}>Add year</button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {snap.academicYears.map((y) => (
            <div key={y.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <p className="text-sm font-bold">{y.name} {y.isCurrent ? <Badge tone="green">Current</Badge> : null}</p>
                <p className="text-xs text-slate-500">{y.startDate} → {y.endDate} · {y.terms.join(', ')}</p>
              </div>
              <div className="flex gap-1">
                {!y.isCurrent ? <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setCurrent(y.id)}>Set current</button> : null}
                {!y.isCurrent ? <button type="button" className="btn-ghost !py-1 text-xs text-red-600" onClick={() => { remove('academicYears', y.id); toast.success('Year deleted'); }}>Delete</button> : null}
              </div>
            </div>
          ))}
        </div>
        {currentYear ? (
          <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
            <Field label="Terms (comma separated)">
              <input
                className="input" defaultValue={currentYear.terms.join(', ')} key={currentYear.id}
                onBlur={(e) => {
                  const terms = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  if (terms.length) {
                    update('academicYears', currentYear.id, { terms });
                    toast.success('Terms updated');
                  }
                }}
              />
            </Field>
            <Field label="Current term">
              <select className="input" value={school.currentTerm} onChange={(e) => { setSchool({ currentTerm: e.target.value }); toast.success('Current term updated'); }}>
                {currentYear.terms.map((t) => <option key={t} value={t}>{t}</option>)}
                {!currentYear.terms.includes(school.currentTerm) ? <option value={school.currentTerm}>{school.currentTerm}</option> : null}
              </select>
            </Field>
          </div>
        ) : null}
      </section>
      <section>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Grading system</h4>
        <Card><ScalesTab /></Card>
      </section>
      <Modal open={yearModal} onClose={() => setYearModal(false)} title="Add academic year"
        footer={<><button type="button" className="btn-secondary" onClick={() => setYearModal(false)}>Cancel</button><button
          type="button" className="btn-primary"
          onClick={() => {
            if (!yf.name.trim() || !yf.startDate || !yf.endDate) {
              toast.error('Name and dates are required');
              return;
            }
            create('academicYears', { name: yf.name.trim(), startDate: yf.startDate, endDate: yf.endDate, terms: yf.terms.split(',').map((s) => s.trim()).filter(Boolean), isCurrent: false });
            toast.success('Academic year added');
            setYearModal(false);
            setYf({ name: '', startDate: '', endDate: '', terms: 'Term 1, Term 2' });
          }}
        >Add</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><input className="input" value={yf.name} onChange={(e) => setYf({ ...yf, name: e.target.value })} placeholder="2026–27" /></Field>
          <Field label="Start date"><input type="date" className="input" value={yf.startDate} onChange={(e) => setYf({ ...yf, startDate: e.target.value })} /></Field>
          <Field label="End date"><input type="date" className="input" value={yf.endDate} onChange={(e) => setYf({ ...yf, endDate: e.target.value })} /></Field>
          <Field label="Terms" className="sm:col-span-2"><input className="input" value={yf.terms} onChange={(e) => setYf({ ...yf, terms: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------------------- finance tab -------------------------------- */

const ALL_METHODS = ['cash', 'bank', 'card', 'online', 'other'];

function FinanceTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const setSchool = useDB((s) => s.setSchool);
  const update = useDB((s) => s.update);
  const school = useSchool();
  const money = useMoney();
  const overdue = snap.invoices.filter((i) => i.status === 'overdue' && i.fine === 0);

  return (
    <div className="space-y-5 p-4">
      <section>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Accepted payment methods</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_METHODS.map((m) => {
            const on = (school.enabledPaymentMethods ?? ALL_METHODS).includes(m);
            return (
              <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize ${on ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-light)] font-semibold text-[var(--brand-primary-dark)]' : 'border-slate-200 text-slate-500'}`}>
                <input
                  type="checkbox" checked={on}
                  onChange={(e) => {
                    const cur = school.enabledPaymentMethods ?? ALL_METHODS;
                    const next = e.target.checked ? [...cur, m] : cur.filter((x) => x !== m);
                    if (!next.length) {
                      toast.error('Keep at least one payment method enabled');
                      return;
                    }
                    setSchool({ enabledPaymentMethods: next });
                  }}
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                />
                {m === 'bank' ? 'Bank transfer' : m}
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-500">Disabled methods disappear from the payment dialog.</p>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold">Default late fine</h4>
          <p className="text-xs text-slate-500">Flat fine applied to overdue invoices on demand.</p>
          <div className="mt-2 flex gap-2">
            <input type="number" min={0} className="input" value={school.defaultFine} onChange={(e) => setSchool({ defaultFine: Number(e.target.value) || 0 })} />
          </div>
          <button
            type="button" className="btn-secondary mt-2 text-xs" disabled={overdue.length === 0}
            onClick={() => {
              overdue.forEach((i) => update('invoices', i.id, { fine: i.fine + school.defaultFine, total: i.total + school.defaultFine }));
              toast.success(`Applied ${money(school.defaultFine)} fine to ${overdue.length} overdue invoices`);
            }}
          >
            Apply to {overdue.length} overdue invoices
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold">Fee catalogue</h4>
          <p className="text-xs text-slate-500">{snap.feeTypes.length} fee types · {snap.feeStructures.length} structures</p>
          <p className="mt-1 text-xs text-slate-500">Discounts granted: <b>{money(snap.invoices.reduce((a, i) => a + i.discount, 0))}</b> · Fines: <b>{money(snap.invoices.reduce((a, i) => a + i.fine, 0))}</b></p>
          <Link to="/fees" className="link mt-2 inline-block text-sm">Manage in Fees & Finance →</Link>
        </div>
      </section>
    </div>
  );
}

/* --------------------------------- system tab -------------------------------- */

function SystemTab(): React.JSX.Element {
  const setSchool = useDB((s) => s.setSchool);
  const school = useSchool();
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:max-w-3xl">
      <Field label="Date format">
        <select className="input" value={school.dateFormat} onChange={(e) => { setSchool({ dateFormat: e.target.value as typeof school.dateFormat }); toast.success('Date format updated'); }}>
          <option value="DD Mon YYYY">04 Oct 2026 (DD Mon YYYY)</option>
          <option value="MM/DD/YYYY">10/04/2026 (MM/DD/YYYY)</option>
          <option value="DD/MM/YYYY">04/10/2026 (DD/MM/YYYY)</option>
          <option value="YYYY-MM-DD">2026-10-04 (YYYY-MM-DD)</option>
        </select>
      </Field>
      <Field label="Time format">
        <select className="input" value={school.timeFormat} onChange={(e) => { setSchool({ timeFormat: e.target.value as typeof school.timeFormat }); toast.success('Time format updated'); }}>
          <option value="12h">12-hour (3:30 PM)</option>
          <option value="24h">24-hour (15:30)</option>
        </select>
      </Field>
      <Field label="Language">
        <select className="input" value={school.language} onChange={(e) => { setSchool({ language: e.target.value }); toast.success('Language preference saved'); }}>
          {['English', 'Urdu', 'Arabic', 'French', 'Spanish', 'Hindi'].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 sm:col-span-2">
        Notification channels (SMS / email / push) are modelled but not connected in this version — providers can be attached per deployment later.
      </div>
    </div>
  );
}

/* ---------------------------------- data tab --------------------------------- */

function DataTab(): React.JSX.Element {
  const snap = useDB((s) => s);
  const resetDemo = useDB((s) => s.resetDemo);
  const replaceAll = useDB((s) => s.replaceAll);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const size = useMemo(() => {
    try {
      const raw = localStorage.getItem('school-erp-db') ?? '';
      return `${Math.round((raw.length / 1024) * 10) / 10} KB stored locally`;
    } catch {
      return '—';
    }
  }, [snap]);

  const download = (filename: string, text: string): void => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportBackup = (): void => {
    const data: Record<string, unknown> = { school: snap.school, exportedAt: nowISO() };
    (Object.keys(snap) as string[]).forEach((k) => {
      const v = (snap as unknown as Record<string, unknown>)[k];
      if (Array.isArray(v)) data[k] = v;
    });
    download(`erp-backup-${todayISO()}.json`, JSON.stringify(data));
    toast.success('Backup downloaded');
  };

  const importBackup = (file: File | undefined): void => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object' || !Array.isArray(data.students)) {
          toast.error('Invalid backup file');
          return;
        }
        replaceAll(data);
        toast.success('Backup restored');
      } catch {
        toast.error('Could not read backup file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid gap-3 p-4 md:grid-cols-3">
      <Card>
        <CardHeader title="Backup" subtitle={size} />
        <div className="space-y-2 p-4 pt-3">
          <button type="button" className="btn-secondary w-full" onClick={exportBackup}><Download className="h-4 w-4" /> Export backup (JSON)</button>
          <button type="button" className="btn-secondary w-full" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import backup</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => importBackup(e.target.files?.[0])} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Demo data" subtitle="Restore the fictional dataset" />
        <div className="p-4 pt-3">
          <p className="text-xs text-slate-500">Replaces everything with the original demo dataset. Your current entries will be lost.</p>
          <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" /> Reset demo data</button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Deployment" subtitle="White-label notes" />
        <div className="space-y-1 p-4 pt-3 text-xs text-slate-500">
          <p>• Branding, currency and session live in Settings → School.</p>
          <p>• Or set <code>VITE_SCHOOL_*</code> env vars per deployment.</p>
          <p>• Auth/RBAC hooks are stubbed in <code>src/auth</code> for a future release.</p>
        </div>
      </Card>
      <ConfirmDialog open={confirmReset} title="Reset all demo data?" message="Every record returns to the original fictional dataset. This cannot be undone." confirmLabel="Reset"
        onConfirm={() => { resetDemo(); setConfirmReset(false); toast.success('Demo data restored'); }} onCancel={() => setConfirmReset(false)} />
    </div>
  );
}
