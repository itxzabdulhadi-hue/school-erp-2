import { NavLink } from 'react-router-dom';
import {
  Award, BadgeCheck, BarChart3, Bell, BookOpen, Boxes, Briefcase, Bus,
  CalendarDays, CalendarRange, ClipboardCheck, FileArchive, FolderOpen, GraduationCap,
  LayoutDashboard, Library, Megaphone, MessagesSquare, PencilLine, School,
  Settings, ShieldAlert, Users, Wallet, X, CalendarOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SchoolLogo } from '../branding/BrandingProvider';
import { useSchool } from '../../lib/useSchool';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { title: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'People', items: [
      { to: '/students', label: 'Students', icon: GraduationCap },
      { to: '/teachers', label: 'Teachers', icon: Users },
      { to: '/staff', label: 'Staff', icon: Briefcase },
      { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
      { to: '/leaves', label: 'Leaves', icon: CalendarOff },
    ],
  },
  {
    title: 'Academics', items: [
      { to: '/classes', label: 'Classes & Sections', icon: School },
      { to: '/subjects', label: 'Subjects', icon: BookOpen },
      { to: '/timetable', label: 'Timetable', icon: CalendarDays },
      { to: '/exams', label: 'Exams & Marks', icon: Award },
      { to: '/results', label: 'Results & Report Cards', icon: BarChart3 },
      { to: '/homework', label: 'Homework', icon: PencilLine },
      { to: '/materials', label: 'Study Materials', icon: FolderOpen },
    ],
  },
  {
    title: 'Finance', items: [
      { to: '/fees', label: 'Fees & Invoices', icon: Wallet },
    ],
  },
  {
    title: 'Operations', items: [
      { to: '/library', label: 'Library', icon: Library },
      { to: '/transport', label: 'Transport', icon: Bus },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/discipline', label: 'Discipline', icon: ShieldAlert },
    ],
  },
  {
    title: 'Communication', items: [
      { to: '/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/events', label: 'Events', icon: CalendarRange },
      { to: '/messages', label: 'Messages', icon: MessagesSquare },
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Records', items: [
      { to: '/certificates', label: 'Certificates', icon: BadgeCheck },
      { to: '/documents', label: 'Documents', icon: FileArchive },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  { title: 'System', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
];

export function Sidebar(props: { open: boolean; onClose: () => void }): React.JSX.Element {
  const school = useSchool();
  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={props.onClose}
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/50 transition-opacity lg:hidden',
          props.open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0',
          props.open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
          <SchoolLogo size={42} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold leading-tight text-slate-900">{school.name}</p>
            <p className="truncate text-[11px] font-medium text-slate-500">{school.academicYear} · {school.currentTerm}</p>
          </div>
          <button type="button" onClick={props.onClose} className="btn-ghost !px-2 lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.title} className="mb-4">
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.title}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={props.onClose}
                      className={({ isActive }) => cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-slate-400">
            White-label ERP · {school.currency} · v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
