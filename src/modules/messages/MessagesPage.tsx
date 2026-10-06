import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessagesSquare, Plus, Send } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { studentName } from '../../lib/db/selectors';
import { useFmt } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { cn, matchesQuery, nowISO, timeAgo } from '../../lib/utils';
import { Badge, Card, Field, Modal, PageHeader, SearchInput, StatusPill } from '../../components/ui/primitives';
import { toast } from '../../components/ui/toast';

const SENDER_ROLES = ['staff', 'teacher', 'admin', 'parent'];

export function MessagesPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const send = useDB((s) => s.sendMessage);
  const update = useDB((s) => s.update);
  const fmt = useFmt();
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [reply, setReply] = useState('');
  const [role, setRole] = useState('staff');
  const [name, setName] = useState('Front Office');

  const threads = useMemo(
    () => [...snap.threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .filter((t) => matchesQuery(q, t.subject, t.participants.join(' '))),
    [snap, q],
  );
  const active = threads.find((t) => t.id === activeId) ?? null;

  const sendReply = (): void => {
    if (!active || !reply.trim()) return;
    send(active.id, role, name.trim() || 'Staff', reply.trim());
    setReply('');
    toast.success('Message sent');
  };

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Parent–teacher communication log · portal-ready structure"
        actions={<button type="button" className="btn-primary" onClick={() => setModal(true)}><Plus className="h-4 w-4" /> New conversation</button>}
      />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className={cn(active && 'hidden lg:block')}>
          <div className="border-b border-slate-100 p-3"><SearchInput value={q} onChange={setQ} placeholder="Search conversations…" /></div>
          <ul className="max-h-[70vh] divide-y divide-slate-50 overflow-y-auto">
            {threads.map((t) => {
              const last = t.messages[t.messages.length - 1];
              const unread = t.messages.filter((m) => !m.read).length;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className={cn('block w-full px-4 py-3 text-left hover:bg-slate-50', activeId === t.id && 'bg-blue-50/60')}
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-800">{t.subject}</p>
                      {unread ? <Badge tone="red">{unread}</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{last ? `${last.senderName}: ${last.body}` : 'No messages yet'}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <StatusPill status={t.status} /> {timeAgo(t.updatedAt)}
                    </p>
                  </button>
                </li>
              );
            })}
            {threads.length === 0 ? <li className="px-4 py-10 text-center text-sm text-slate-400">No conversations.</li> : null}
          </ul>
        </Card>

        <Card className={cn(!active && 'hidden lg:block')}>
          {!active ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center p-10 text-center">
              <MessagesSquare className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold">Select a conversation</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">Threads, participants, attachments and read-state are modelled for a future parent portal. Live messaging arrives with authentication.</p>
            </div>
          ) : (
            <div className="flex h-full max-h-[75vh] flex-col">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <button type="button" className="btn-ghost !px-2 lg:hidden" onClick={() => setActiveId(null)}><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{active.subject}</p>
                  <p className="truncate text-xs text-slate-500">
                    {active.participants.join(' · ')}
                    {active.relatedStudentId ? <> · <Link to={`/students/${active.relatedStudentId}`} className="link">{studentName(snap.students.find((s) => s.id === active.relatedStudentId))}</Link></> : null}
                  </p>
                </div>
                <button
                  type="button" className="btn-secondary !py-1 text-xs"
                  onClick={() => { update('threads', active.id, { status: active.status === 'open' ? 'closed' : 'open' }); toast.success(active.status === 'open' ? 'Conversation closed' : 'Conversation reopened'); }}
                >
                  {active.status === 'open' ? 'Close' : 'Reopen'}
                </button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {active.messages.map((m) => {
                  const mine = m.senderRole === role;
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm', mine ? 'rounded-br-sm bg-[var(--brand-primary)] text-white' : 'rounded-bl-sm bg-slate-100 text-slate-800')}>
                        <p className={cn('text-[11px] font-bold', mine ? 'text-blue-100' : 'text-slate-500')}>{m.senderName} · {m.senderRole}</p>
                        <p className="mt-0.5 whitespace-pre-line">{m.body}</p>
                        <p className={cn('mt-1 text-right text-[10px]', mine ? 'text-blue-100' : 'text-slate-400')}>{fmt.datetime(m.sentAt)}</p>
                      </div>
                    </div>
                  );
                })}
                {active.messages.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No messages yet — start the conversation below.</p> : null}
              </div>
              {active.status === 'open' ? (
                <div className="border-t border-slate-100 p-3">
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <select value={role} onChange={(e) => setRole(e.target.value)} className="input !py-1.5 text-xs capitalize">
                      {SENDER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="input !py-1.5 text-xs" placeholder="Your display name" />
                  </div>
                  <div className="flex gap-2">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} className="input flex-1" placeholder="Write a message…" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply(); }} />
                    <button type="button" className="btn-primary self-end" disabled={!reply.trim()} onClick={sendReply}><Send className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <p className="border-t border-slate-100 p-3 text-center text-xs text-slate-400">This conversation is closed. Reopen it to continue.</p>
              )}
            </div>
          )}
        </Card>
      </div>
      <ThreadModal key={modal ? 'open' : 'closed'} open={modal} onClose={() => setModal(false)} onCreated={setActiveId} />
    </div>
  );
}

function ThreadModal(props: { open: boolean; onClose: () => void; onCreated: (id: string) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const create = useDB((s) => s.create);
  const [f, setF] = useState({ subject: '', participants: '', relatedStudentId: '', senderName: 'Front Office', body: '' });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.open) return <></>;

  const save = (): void => {
    const e: Errors = {};
    if (required(f.subject)) e.subject = 'Required';
    if (required(f.body)) e.body = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const id = create('threads', {
      subject: f.subject.trim(),
      relatedStudentId: f.relatedStudentId || undefined,
      participants: f.participants.split(',').map((s) => s.trim()).filter(Boolean).concat([f.senderName.trim() || 'Staff']),
      messages: [{ id: `m_${Date.now()}`, threadId: '', senderRole: 'staff', senderName: f.senderName.trim() || 'Staff', body: f.body.trim(), sentAt: nowISO(), read: true }],
      status: 'open', createdAt: nowISO(), updatedAt: nowISO(),
    });
    toast.success('Conversation started');
    props.onCreated(id);
    props.onClose();
  };

  return (
    <Modal open onClose={props.onClose} title="New conversation"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Start</button></>}>
      <div className="grid gap-3">
        <Field label="Subject" error={errors.subject}><input className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="Participants" optional><input className="input" value={f.participants} onChange={(e) => setF({ ...f, participants: e.target.value })} placeholder="Parent of Ali Khan, Class Teacher" /></Field>
        <Field label="Related student" optional>
          <select className="input" value={f.relatedStudentId} onChange={(e) => setF({ ...f, relatedStudentId: e.target.value })}>
            <option value="">—</option>
            {snap.students.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{studentName(s)}</option>)}
          </select>
        </Field>
        <Field label="Your name"><input className="input" value={f.senderName} onChange={(e) => setF({ ...f, senderName: e.target.value })} /></Field>
        <Field label="First message" error={errors.body}><textarea className="input" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
