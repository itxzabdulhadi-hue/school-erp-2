import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert } from 'react-native';
import { useNotifications } from '../api/query';
import { useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { AppIcon, type IconName } from '../components/AppIcon';
import { Badge, Btn, Card, ListRow, ScrollScreen, SectionTitle } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

interface Entry {
  title: string;
  sub: string;
  icon: IconName;
  route: keyof RootStackParamList;
  params?: object;
  perm?: string;
}

const ENTRIES: Entry[] = [
  { title: 'Students', sub: 'Directory and profiles', icon: 'people', route: 'Students', perm: PERM.studentsView },
  { title: 'Finance', sub: 'Invoices and payments', icon: 'cash', route: 'Finance', perm: PERM.feesCollect },
  { title: 'My fees', sub: 'Invoices, payments, receipts', icon: 'card', route: 'Fees', perm: PERM.feesView },
  { title: 'Attendance', sub: 'Sheets and summaries', icon: 'clipboard', route: 'Attendance', perm: PERM.attendanceView },
  { title: 'Timetable', sub: 'Weekly schedules', icon: 'calendar', route: 'Timetable', perm: PERM.timetableView },
  { title: 'Exams', sub: 'Date-sheets and schedules', icon: 'time', route: 'Exams', perm: PERM.examsView },
  { title: 'Results', sub: 'Marks, grades, ranks', icon: 'stats-chart', route: 'Results', perm: PERM.resultsView },
  { title: 'Homework', sub: 'Assignments and submissions', icon: 'book', route: 'Homework', perm: PERM.homeworkView },
  { title: 'Study materials', sub: 'Notes, videos, files', icon: 'folder', route: 'Materials', perm: PERM.materialsView },
  { title: 'Announcements', sub: 'School broadcasts', icon: 'megaphone', route: 'Announcements', perm: PERM.announcementsView },
  { title: 'Events', sub: 'Calendar and venues', icon: 'calendar', route: 'Events', perm: PERM.eventsView },
  { title: 'Notifications', sub: 'Your alerts inbox', icon: 'notifications', route: 'Notifications', perm: PERM.notificationsView },
  { title: 'Documents', sub: 'Files and uploads', icon: 'document-text', route: 'Documents', perm: PERM.documentsView },
  { title: 'Directory', sub: 'Teachers and staff', icon: 'briefcase', route: 'Directory', perm: PERM.staffView },
  { title: 'Users & access', sub: 'Logins and roles', icon: 'person', route: 'Users', perm: PERM.usersView },
  { title: 'My account', sub: 'Profile, app, sign out', icon: 'settings', route: 'Profile' },
];

export function MoreScreen(): React.JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, permissions, logout } = useSession();
  const notifications = useNotifications();
  const unread = notifications.data?.unreadCount ?? 0;

  const visible = ENTRIES.filter((e) => {
    if (!e.perm) return true;
    if (e.route === 'Finance') return user?.role === 'admin'; // admin console only
    if (e.route === 'Fees') return user?.role === 'student'; // students get the personal view
    if (e.route === 'Students' && user?.role === 'student') return false; // students have My profile instead
    return can(permissions, e.perm);
  });

  const confirmLogout = (): void => {
    Alert.alert('Sign out?', 'You will need your email and password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <ScrollScreen refreshing={notifications.isFetching} onRefresh={() => void notifications.refetch()}>
      <SectionTitle>Browse</SectionTitle>
      <Card>
        {visible.map((e) => (
          <ListRow
            key={e.title}
            title={e.title}
            sub={e.sub}
            left={<AppIcon name={e.icon} size={22} color="#334155" />}
            right={e.route === 'Notifications' && unread > 0
              ? <Badge tone="danger">{unread > 99 ? '99+' : unread}</Badge>
              : <AppIcon name="chevron-forward" size={20} color="#94a3b8" />}
            onPress={() => nav.navigate(e.route, e.params as never)}
          />
        ))}
      </Card>
      <Btn title={`Sign out (${user?.name ?? ''})`} variant="secondary" onPress={confirmLogout} icon="log-out" />
    </ScrollScreen>
  );
}
