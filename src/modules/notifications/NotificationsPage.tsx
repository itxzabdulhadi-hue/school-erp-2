import { useMemo, useState } from 'react';
import { Bell, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import type { Notification, NotificationType } from '../../lib/db/types';
import { timeAgo } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { Badge, Card, ConfirmDialog, Field, Modal, PageHeader } from '../../components/ui/primitives';
import { toast } from '../../components/ui/toast';

const TYPES: { id: NotificationType; label: string; tone: 'red' | 'amber' | 'blue' | 'purple' | 'cyan' | 'green' | 'slate' }[] = [
  { id: 'fee-due', label: 'Fee due', tone: 'amber' },
  { id: 'fee-overdue', label: 'Fee overdue', tone: 'red' },
  { id: 'attendance', label: 'Attendance', tone: 'red' },
  { id: 'exam', label: 'Exam', tone: 'purple' },
  { id: 'assignment', label: 'Assignment', tone: 'cyan' },
  { id: 'announcement', label: 'Announcement', tone: 'blue' },
  { id: 'event', label: 'Event', tone: 'green' },
  { id: 'general', label: 'General', tone: 'slate' },
];

export function NotificationsPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const remove = useDB((s) => s.remove);
  const update = useDB((s) => s.update);
  const markAll = useDB((s) => s.markAllNotificationsRead);
  const push = useDB((s) => s.pushNotification);
  const [type, setType] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [modal, setModal] = useState(false);
  const [deleting, setDeleting] = useState<Notification | null>(null);
  const [f, setF] = useState({ type: 'general' as NotificationType, title: '', body: '', audience: '' });

  const filtered = useMemo(
    () => [...snap.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((n) => (!type || n.type === type) && (!unreadOnly || !n.isRead)),
    [snap, type, unreadOnly],
  );
  const unread = snap.notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <PageHeader
        title="Notification center"
        subtitle={`${unread} unread · delivery providers (SMS/email/push) plug in here later`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => { markAll(); toast.success('All marked as read'); }}>Mark all read</button>
            <button type="button" className="btn-primary" onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Compose</button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input sm:w-56">
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="h-4 w-4 accent-[var(--brand-primary)]" />
            Unread only
          </label>
        </div>
        <ul className="divide-y divide-slate-100">
          {filtered.map((n) => (
            <li key={n.id} className={cn('flex gap-3 px-4 py-3 sm:px-5', !n.isRead && 'bg-blue-50/40')}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{n.title}</p>
                  <Badge tone={TYPES.find((t) => t.id === n.type)?.tone ?? 'slate'}>{TYPES.find((t) => t.id === n.type)?.label}</Badge>
                  {!n.isRead ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}{n.audience ? ` · ${n.audience}` : ''}</p>
              </div>
              <div className="flex shrink-0 items-start gap-1">
                {!n.isRead ? <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => update('notifications', n.id, { isRead: true })}>Read</button> : null}
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleting(n)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
          {filtered.length === 0 ? <li className="px-5 py-10 text-center text-sm text-slate-400">No notifications.</li> : null}
        </ul>
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title="Compose notification"
        footer={<><button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button><button
          type="button" className="btn-primary"
          onClick={() => {
            if (!f.title.trim() || !f.body.trim()) {
              toast.error('Title and message are required');
              return;
            }
            push({ type: f.type, title: f.title.trim(), body: f.body.trim(), audience: f.audience.trim() || undefined });
            toast.success('Notification queued');
            setModal(false);
            setF({ type: 'general', title: '', body: '', audience: '' });
          }}
        >Queue</button></>}>
        <div className="grid gap-3">
          <Field label="Type">
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as NotificationType })}>
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Message"><textarea className="input" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <Field label="Audience" optional><input className="input" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} placeholder="All parents / Grade 5 / Staff…" /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete notification?" message="This removes it from the center." confirmLabel="Delete"
        onConfirm={() => { if (deleting) remove('notifications', deleting.id); setDeleting(null); }} onCancel={() => setDeleting(null)} />
    </div>
  );
}
