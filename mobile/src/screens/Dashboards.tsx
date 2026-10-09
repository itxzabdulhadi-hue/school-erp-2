import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import {
  useAnnouncements, useEvents, useHomework, useInvoices, useMyAttendance,
  useNotifications, useStaffList, useStudents, useTeachers, useTimetable, useExams,
} from '../api/query';
import { useSession } from '../auth/session';
import { can } from '../auth/permissions';
import { useFormat, useTheme } from '../branding/theme';
import { AppIcon, type IconName } from '../components/AppIcon';
import { Badge, Card, ListRow, ScrollScreen, SectionTitle, StatCard } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoWeekday(): number {
  return ((new Date().getDay() + 6) % 7) + 1; // Mon=1..Sun=7 (server convention)
}

interface Link {
  title: string;
  sub: string;
  icon: IconName;
  route: keyof RootStackParamList;
  params?: object;
  badge?: string;
}

function QuickLinks({ links }: { links: Link[] }): React.JSX.Element {
  const nav = useNavigation<Nav>();
  return (
    <Card>
      {links.map((l) => (
        <ListRow
          key={l.title}
          title={l.title}
          sub={l.sub}
          left={<AppIcon name={l.icon} size={22} color="#334155" />}
          right={l.badge
            ? <Badge tone="danger">{l.badge}</Badge>
            : <AppIcon name="chevron-forward" size={20} color="#94a3b8" />}
          onPress={() => nav.navigate(l.route, l.params as never)}
        />
      ))}
    </Card>
  );
}

function Header({ sub }: { sub: string }): React.JSX.Element {
  const { user } = useSession();
  const { brand } = useTheme();
  const first = user?.name.split(' ')[0] ?? 'there';
  return (
    <View>
      <Text style={styles.hello}>{greeting()}, {first}</Text>
      <Text style={[styles.sub, { color: brand.primary }]}>{sub}</Text>
    </View>
  );
}

/* ---------------------------------- admin ---------------------------------- */

export function AdminDashboard(): React.JSX.Element {
  const fmt = useFormat();
  const students = useStudents();
  const teachers = useTeachers();
  const staff = useStaffList();
  const invoices = useInvoices();
  const notifications = useNotifications();
  const refreshing = students.isFetching || teachers.isFetching || staff.isFetching || invoices.isFetching;
  const refetchAll = (): void => {
    void students.refetch(); void teachers.refetch(); void staff.refetch(); void invoices.refetch(); void notifications.refetch();
  };

  const outstanding = (invoices.data ?? [])
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((t, i) => t + Number(i.balance), 0);
  const overdue = (invoices.data ?? []).filter((i) => i.status === 'overdue' || (i.status !== 'paid' && i.status !== 'cancelled' && i.dueDate < todayISO())).length;

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={refetchAll}>
      <Header sub="Administrator overview" />
      <View style={styles.stats}>
        <StatCard label="Students" value={String(students.data?.length ?? '—')} icon="people" onPress={() => undefined} />
        <StatCard label="Teachers" value={String(teachers.data?.length ?? '—')} icon="school" />
      </View>
      <View style={styles.stats}>
        <StatCard label="Outstanding fees" value={fmt.money(outstanding)} sub={overdue > 0 ? `${overdue} overdue` : 'All clear'} icon="cash" />
        <StatCard label="Unread alerts" value={String(notifications.data?.unreadCount ?? 0)} icon="notifications" />
      </View>
      <SectionTitle>Manage</SectionTitle>
      <QuickLinks links={[
        { title: 'Students', sub: 'Directory, profiles, admissions', icon: 'people', route: 'Students' },
        { title: 'Finance', sub: 'Invoices, payments, receipts', icon: 'cash', route: 'Finance' },
        { title: 'Attendance', sub: 'Day sheets and summaries', icon: 'clipboard', route: 'Attendance' },
        { title: 'Users & access', sub: 'Logins, roles, linked profiles', icon: 'person', route: 'Users' },
        { title: 'Announcements', sub: 'Broadcasts to the school', icon: 'megaphone', route: 'Announcements' },
        { title: 'Documents', sub: 'School files and uploads', icon: 'folder', route: 'Documents' },
      ]}
      />
    </ScrollScreen>
  );
}

/* --------------------------------- teacher --------------------------------- */

export function TeacherDashboard(): React.JSX.Element {
  const { user } = useSession();
  const fmt = useFormat();
  const slots = useTimetable({ mine: '1' });
  const homework = useHomework();
  const refreshing = slots.isFetching || homework.isFetching;
  const refetchAll = (): void => { void slots.refetch(); void homework.refetch(); };

  const todays = (slots.data ?? []).filter((s) => Number(s.dayOfWeek) === isoWeekday());
  const dueSoon = (homework.data ?? [])
    .filter((h) => h.dueDate >= todayISO() && h.status === 'active')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const pendingReview = (homework.data ?? []).reduce((t, h) => t + Number(h.submissionCount ?? 0), 0);
  void user;

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={refetchAll}>
      <Header sub="Teacher workspace" />
      <View style={styles.stats}>
        <StatCard label="Periods today" value={String(todays.length)} icon="time" />
        <StatCard label="Submissions in" value={String(pendingReview)} sub="Across active homework" icon="book" />
      </View>
      <SectionTitle>Today's periods</SectionTitle>
      <Card>
        {todays.length === 0 && <Text style={styles.muted}>No periods scheduled today.</Text>}
        {todays.slice(0, 6).map((s) => (
          <ListRow
            key={s.id}
            title={`${s.subjectName} · ${s.className}`}
            sub={`${fmt.time(s.startTime)} – ${fmt.time(s.endTime)}${s.room ? ` · Room ${s.room}` : ''}`}
          />
        ))}
      </Card>
      <SectionTitle>Due soon</SectionTitle>
      <Card>
        {dueSoon.length === 0 && <Text style={styles.muted}>Nothing due in the coming days.</Text>}
        {dueSoon.map((h) => (
          <HomeworkLinkRow key={h.id} id={h.id} title={h.title} sub={`${h.className} · Due ${fmt.date(h.dueDate)}`} />
        ))}
      </Card>
      <SectionTitle>Teach</SectionTitle>
      <QuickLinks links={[
        { title: 'Mark attendance', sub: 'Today’s day sheets', icon: 'clipboard', route: 'Attendance' },
        { title: 'Homework', sub: 'Assign and review work', icon: 'book', route: 'Homework' },
        { title: 'Enter results', sub: 'Exams, marks, report data', icon: 'stats-chart', route: 'Exams' },
        { title: 'Study materials', sub: 'Share files and links', icon: 'folder', route: 'Materials' },
      ]}
      />
    </ScrollScreen>
  );
}

function HomeworkLinkRow({ id, title, sub }: { id: string; title: string; sub: string }): React.JSX.Element {
  const nav = useNavigation<Nav>();
  return <ListRow title={title} sub={sub} onPress={() => nav.navigate('HomeworkDetail', { id })} />;
}

/* --------------------------------- student --------------------------------- */

export function StudentDashboard(): React.JSX.Element {
  const { user } = useSession();
  const { brand } = useTheme();
  const fmt = useFormat();
  const nav = useNavigation<Nav>();
  const att = useMyAttendance();
  const homework = useHomework();
  const invoices = useInvoices();
  const exams = useExams();
  const refreshing = att.isFetching || homework.isFetching || invoices.isFetching || exams.isFetching;
  const refetchAll = (): void => { void att.refetch(); void homework.refetch(); void invoices.refetch(); void exams.refetch(); };

  const summary = att.data?.summary;
  const dueSoon = (homework.data ?? []).filter((h) => h.dueDate >= todayISO() && h.status === 'active').length;
  const due = (invoices.data ?? []).filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const nextExam = (exams.data ?? []).filter((e) => e.endDate >= todayISO() && e.status !== 'cancelled').sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={refetchAll}>
      <Header sub="Student dashboard" />
      <Card style={{ backgroundColor: brand.primary }}>
        <Text style={styles.heroLabel}>Attendance</Text>
        <Text style={styles.heroValue}>{summary ? `${summary.pct}%` : '—'}</Text>
        <Text style={styles.heroSub}>
          {summary ? `${summary.present} present · ${summary.absent} absent · ${summary.leave} leave` : 'Loading…'}
        </Text>
      </Card>
      <View style={styles.stats}>
        <StatCard label="Homework due" value={String(dueSoon)} icon="book" />
        <StatCard label="Fees due" value={fmt.money(due.reduce((t, i) => t + Number(i.balance), 0))} sub={due.length ? `${due.length} invoice(s)` : 'All clear'} icon="card" />
      </View>
      {nextExam && (
        <Card onPress={() => nav.navigate('ExamDetail', { id: nextExam.id })}>
          <Text style={styles.cardLabel}>Next exam</Text>
          <Text style={styles.cardTitle}>{nextExam.name}</Text>
          <Text style={styles.muted}>{fmt.date(nextExam.startDate)} – {fmt.date(nextExam.endDate)}</Text>
        </Card>
      )}
      <SectionTitle>Study</SectionTitle>
      <QuickLinks links={[
        { title: 'My timetable', sub: 'Weekly class schedule', icon: 'calendar', route: 'Timetable' },
        { title: 'My results', sub: 'Marks and report cards', icon: 'stats-chart', route: 'Results' },
        { title: 'Study materials', sub: 'Notes, videos, files', icon: 'folder', route: 'Materials' },
        ...(user?.linkedStudentId
          ? [{ title: 'My profile', sub: 'Personal and class record', icon: 'person' as IconName, route: 'StudentDetail' as const, params: { id: user.linkedStudentId } }]
          : []),
      ]}
      />
    </ScrollScreen>
  );
}

/* ---------------------------------- staff ---------------------------------- */

export function StaffDashboard(): React.JSX.Element {
  const fmt = useFormat();
  const teachers = useTeachers();
  const staff = useStaffList();
  const announcements = useAnnouncements();
  const events = useEvents({ from: todayISO() });
  const refreshing = teachers.isFetching || staff.isFetching || announcements.isFetching || events.isFetching;
  const refetchAll = (): void => { void teachers.refetch(); void staff.refetch(); void announcements.refetch(); void events.refetch(); };

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={refetchAll}>
      <Header sub="Staff workspace" />
      <View style={styles.stats}>
        <StatCard label="Teachers" value={String(teachers.data?.length ?? '—')} icon="school" />
        <StatCard label="Staff" value={String(staff.data?.length ?? '—')} icon="briefcase" />
      </View>
      <SectionTitle>Latest announcements</SectionTitle>
      <Card>
        {(announcements.data ?? []).slice(0, 3).map((a) => (
          <ListRow key={a.id} title={a.title} sub={fmt.date(a.publishDate)} />
        ))}
        {(announcements.data ?? []).length === 0 && <Text style={styles.muted}>No announcements.</Text>}
      </Card>
      <SectionTitle>Upcoming events</SectionTitle>
      <Card>
        {(events.data ?? []).slice(0, 3).map((e) => (
          <ListRow key={e.id} title={e.title} sub={`${fmt.date(e.date)}${e.location ? ` · ${e.location}` : ''}`} />
        ))}
        {(events.data ?? []).length === 0 && <Text style={styles.muted}>No upcoming events.</Text>}
      </Card>
      <SectionTitle>Work</SectionTitle>
      <QuickLinks links={[
        { title: 'Directory', sub: 'Teachers and staff contacts', icon: 'briefcase', route: 'Directory' },
        { title: 'Documents', sub: 'View and upload files', icon: 'folder', route: 'Documents' },
        { title: 'Notifications', sub: 'Your alerts inbox', icon: 'notifications', route: 'Notifications' },
      ]}
      />
    </ScrollScreen>
  );
}

export function useCan(permission: string): boolean {
  const { permissions } = useSession();
  return can(permissions, permission);
}

const styles = StyleSheet.create({
  hello: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 12 },
  muted: { fontSize: 14, color: '#64748b' },
  heroLabel: { fontSize: 13, fontWeight: '600', color: '#e2e8f0' },
  heroValue: { fontSize: 40, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 13, color: '#e2e8f0' },
  cardLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginVertical: 2 },
});
