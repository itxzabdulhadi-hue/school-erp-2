import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, hueFromString, initials } from '../../lib/utils';

/* --------------------------------- Badge ---------------------------------- */

type Tone = 'slate' | 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'cyan' | 'pink';

const TONE_BG: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  purple: 'bg-violet-100 text-violet-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  pink: 'bg-pink-100 text-pink-800',
};

export function Badge(props: { tone?: Tone; children: ReactNode; className?: string }): React.JSX.Element {
  return <span className={cn('badge', TONE_BG[props.tone ?? 'slate'], props.className)}>{props.children}</span>;
}

const STATUS_TONES: Record<string, Tone> = {
  active: 'green', present: 'green', paid: 'green', approved: 'green', issued: 'green',
  returned: 'slate', submitted: 'green', graded: 'purple', open: 'blue', scheduled: 'blue',
  assigned: 'blue', resolved: 'green', completed: 'green', ongoing: 'blue', normal: 'slate',
  low: 'slate', inactive: 'slate', draft: 'slate', closed: 'slate', pending: 'amber',
  partial: 'amber', late: 'amber', half: 'amber', 'half-day': 'amber', overdue: 'red',
  absent: 'red', rejected: 'red', failed: 'red', fail: 'red', withdrawn: 'red',
  terminated: 'red', lost: 'red', serious: 'red', urgent: 'red', emergency: 'red',
  excused: 'cyan', leave: 'cyan', 'on-leave': 'cyan', transferred: 'purple', graduated: 'purple',
  retired: 'purple', resigned: 'slate', maintenance: 'amber', high: 'amber', minor: 'slate',
  moderate: 'amber', cancelled: 'slate',
};

export function StatusPill(props: { status: string; className?: string }): React.JSX.Element {
  const key = props.status.toLowerCase().replace(/[_ ]/g, '-');
  const label = props.status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge tone={STATUS_TONES[key] ?? 'slate'} className={props.className}>{label}</Badge>;
}

/* --------------------------------- Avatar ---------------------------------- */

export function Avatar(props: { name: string; photo?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }): React.JSX.Element {
  const cls = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' }[props.size ?? 'md'];
  if (props.photo) {
    return <img src={props.photo} alt={props.name} className={cn('rounded-full object-cover', cls)} />;
  }
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold text-white', cls)}
      style={{ backgroundColor: `hsl(${hueFromString(props.name)} 55% 45%)` }}
      aria-label={props.name}
    >
      {initials(props.name)}
    </div>
  );
}

/* --------------------------------- Cards ----------------------------------- */

export function Card(props: { children: ReactNode; className?: string }): React.JSX.Element {
  return <div className={cn('card', props.className)}>{props.children}</div>;
}

export function CardHeader(props: { title: string; subtitle?: string; action?: ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div>
        <h3 className="section-title">{props.title}</h3>
        {props.subtitle ? <p className="mt-0.5 text-xs text-slate-500">{props.subtitle}</p> : null}
      </div>
      {props.action}
    </div>
  );
}

export function StatCard(props: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  onClick?: () => void;
}): React.JSX.Element {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        'card flex w-full items-center gap-3 p-4 text-left transition',
        props.onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-pop',
      )}
    >
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', props.tone ?? 'bg-blue-100 text-blue-700')}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-500">{props.label}</div>
        <div className="truncate text-xl font-bold text-slate-900">{props.value}</div>
        {props.sub ? <div className="truncate text-xs text-slate-500">{props.sub}</div> : null}
      </div>
    </button>
  );
}

/* --------------------------------- Header ----------------------------------- */

export function PageHeader(props: { title: string; subtitle?: string; actions?: ReactNode }): React.JSX.Element {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="page-title">{props.title}</h1>
        {props.subtitle ? <p className="page-sub">{props.subtitle}</p> : null}
      </div>
      {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
    </div>
  );
}

/* --------------------------------- Forms ------------------------------------ */

export function Field(props: { label: string; error?: string; children: ReactNode; optional?: boolean; className?: string }): React.JSX.Element {
  return (
    <div className={props.className}>
      <label className="label">
        {props.label}
        {props.optional ? <span className="ml-1 font-normal normal-case text-slate-400">(optional)</span> : null}
      </label>
      {props.children}
      {props.error ? <p className="mt-1 text-xs text-red-600">{props.error}</p> : null}
    </div>
  );
}

export function SearchInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }): React.JSX.Element {
  return (
    <div className={cn('relative', props.className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? 'Search…'}
        className="input pl-9 pr-8"
      />
      {props.value ? (
        <button type="button" onClick={() => props.onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

/* --------------------------------- Modal ------------------------------------ */

const MODAL_SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export function Modal(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof MODAL_SIZES;
}): React.JSX.Element | null {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={props.onClose} role="dialog" aria-modal="true">
      <div
        className={cn('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', MODAL_SIZES[props.size ?? 'md'])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{props.title}</h2>
            {props.subtitle ? <p className="mt-0.5 text-xs text-slate-500">{props.subtitle}</p> : null}
          </div>
          <button type="button" onClick={props.onClose} className="btn-ghost !px-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{props.children}</div>
        {props.footer ? <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{props.footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element | null {
  return (
    <Modal open={props.open} onClose={props.onCancel} title={props.title} size="sm">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', props.danger === false ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm text-slate-600">{props.message}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={props.onCancel}>Cancel</button>
        <button type="button" className={props.danger === false ? 'btn-primary' : 'btn-danger'} disabled={props.busy} onClick={props.onConfirm}>
          {props.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------- States ----------------------------------- */

export function EmptyState(props: { icon?: LucideIcon; title: string; hint?: string; action?: ReactNode }): React.JSX.Element {
  const Icon = props.icon ?? Inbox;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-800">{props.title}</h3>
      {props.hint ? <p className="mt-1 max-w-sm text-xs text-slate-500">{props.hint}</p> : null}
      {props.action ? <div className="mt-4">{props.action}</div> : null}
    </div>
  );
}

export function Skeleton(props: { className?: string }): React.JSX.Element {
  return <div className={cn('skeleton rounded-lg', props.className ?? 'h-4 w-full')} />;
}

export function TableSkeleton(props: { rows?: number }): React.JSX.Element {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: props.rows ?? 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/* ---------------------------------- Tabs ------------------------------------ */

export function Tabs<T extends string>(props: { tabs: { id: T; label: string; count?: number }[]; active: T; onChange: (id: T) => void }): React.JSX.Element {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {props.tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => props.onChange(t.id)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition',
            props.active === t.id
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar(props: { value: number; tone?: string; className?: string }): React.JSX.Element {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', props.className)}>
      <div className={cn('h-full rounded-full transition-all', props.tone ?? 'bg-[var(--brand-primary)]')} style={{ width: `${Math.min(100, Math.max(0, props.value))}%` }} />
    </div>
  );
}
