import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Menu, Search, Settings } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { useFmt, useSchool } from '../../lib/useSchool';
import { timeAgo, todayISO } from '../../lib/utils';
import { cn } from '../../lib/utils';

export function Header(props: { onMenu: () => void }): React.JSX.Element {
  const navigate = useNavigate();
  const school = useSchool();
  const fmt = useFmt();
  const notifications = useDB((s) => s.notifications);
  const markAll = useDB((s) => s.markAllNotificationsRead);
  const [q, setQ] = useState('');
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <button type="button" onClick={props.onMenu} className="btn-ghost !px-2 lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <form
          className="relative hidden max-w-md flex-1 sm:block"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students, staff, invoices…"
            className="input bg-slate-50 pl-9"
          />
        </form>
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="btn-ghost !px-2 sm:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <span className="mr-1 hidden text-xs font-medium text-slate-500 md:block">
            {fmt.date(todayISO())} · {school.currentTerm}
          </span>
          <div className="relative" ref={bellRef}>
            <button
              type="button"
              onClick={() => setBellOpen((v) => !v)}
              className="btn-ghost relative !px-2.5"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </button>
            {bellOpen ? (
              <div className="absolute right-0 top-12 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-800">Notifications</p>
                  <button type="button" onClick={markAll} className="link text-xs">Mark all read</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.slice(0, 7).map((n) => (
                    <Link
                      key={n.id}
                      to="/notifications"
                      onClick={() => setBellOpen(false)}
                      className={cn('block border-b border-slate-50 px-4 py-2.5 hover:bg-slate-50', !n.isRead && 'bg-blue-50/50')}
                    >
                      <p className="text-[13px] font-semibold text-slate-800">{n.title}</p>
                      <p className="truncate text-xs text-slate-500">{n.body}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                    </Link>
                  ))}
                  {notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p> : null}
                </div>
                <Link to="/notifications" onClick={() => setBellOpen(false)} className="block bg-slate-50 px-4 py-2.5 text-center text-xs font-semibold text-[var(--brand-primary)] hover:underline">
                  View all notifications
                </Link>
              </div>
            ) : null}
          </div>
          <Link to="/settings" className="btn-ghost !px-2.5" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
