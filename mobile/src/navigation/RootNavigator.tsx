import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';
import { useNotifications } from '../api/query';
import type { Role } from '../api/types';
import { useSession } from '../auth/session';
import { useTheme } from '../branding/theme';
import { AppIcon, type IconName } from '../components/AppIcon';
import { LoginScreen } from '../screens/LoginScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { AdminDashboard, StaffDashboard, StudentDashboard, TeacherDashboard } from '../screens/Dashboards';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { AttendanceScreen } from '../screens/AttendanceScreen';
import { DirectoryScreen } from '../screens/DirectoryScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { ExamsScreen, ExamDetailScreen, ResultsScreen, EnterMarksScreen } from '../screens/ExamScreens';
import { FinanceScreen, FeesScreen, InvoiceDetailScreen, ReceiptScreen } from '../screens/FinanceScreens';
import { HomeworkScreen, HomeworkDetailScreen } from '../screens/HomeworkScreens';
import { MaterialsScreen } from '../screens/MaterialsScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { StudentsScreen, StudentDetailScreen } from '../screens/StudentScreens';
import { TimetableScreen } from '../screens/TimetableScreen';
import { UsersScreen } from '../screens/UsersScreen';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function RoleHome(): React.JSX.Element {
  const { user } = useSession();
  if (user?.role === 'teacher') return <TeacherDashboard />;
  if (user?.role === 'student') return <StudentDashboard />;
  if (user?.role === 'staff') return <StaffDashboard />;
  return <AdminDashboard />;
}

interface TabDef {
  name: keyof MainTabParamList;
  title: string;
  icon: IconName;
  component: ComponentType;
}

const TABS: Record<Role, TabDef[]> = {
  admin: [
    { name: 'HomeTab', title: 'Home', icon: 'home', component: RoleHome },
    { name: 'StudentsTab', title: 'Students', icon: 'people', component: StudentsScreen },
    { name: 'FinanceTab', title: 'Finance', icon: 'cash', component: FinanceScreen },
    { name: 'MoreTab', title: 'More', icon: 'settings', component: MoreScreen },
  ],
  teacher: [
    { name: 'HomeTab', title: 'Home', icon: 'home', component: RoleHome },
    { name: 'AttendanceTab', title: 'Attendance', icon: 'clipboard', component: AttendanceScreen },
    { name: 'HomeworkTab', title: 'Homework', icon: 'book', component: HomeworkScreen },
    { name: 'MoreTab', title: 'More', icon: 'settings', component: MoreScreen },
  ],
  student: [
    { name: 'HomeTab', title: 'Home', icon: 'home', component: RoleHome },
    { name: 'HomeworkTab', title: 'Homework', icon: 'book', component: HomeworkScreen },
    { name: 'FeesTab', title: 'Fees', icon: 'card', component: FeesScreen },
    { name: 'MoreTab', title: 'More', icon: 'settings', component: MoreScreen },
  ],
  staff: [
    { name: 'HomeTab', title: 'Home', icon: 'home', component: RoleHome },
    { name: 'DirectoryTab', title: 'Directory', icon: 'briefcase', component: DirectoryScreen },
    { name: 'MoreTab', title: 'More', icon: 'settings', component: MoreScreen },
  ],
};

function MainTabs(): React.JSX.Element {
  const { user } = useSession();
  const { brand } = useTheme();
  const notifications = useNotifications();
  const unread = notifications.data?.unreadCount ?? 0;
  const tabs = TABS[user?.role ?? 'staff'];

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: '#64748b',
        tabBarIcon: ({ color, size }) => {
          const def = tabs.find((t) => t.name === route.name);
          return <AppIcon name={def?.icon ?? 'home'} size={size} color={color} />;
        },
      })}
    >
      {tabs.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            title: t.title,
            tabBarBadge: t.name === 'MoreTab' && unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export function RootNavigator(): React.JSX.Element {
  const { status } = useSession();
  const { brand } = useTheme();

  if (status === 'loading') return <SplashScreen />;

  const theme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, primary: brand.primary, background: '#f1f5f9' },
  };

  return (
    <NavigationContainer theme={theme}>
      {status === 'signed-out' ? (
        <LoginScreen />
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: brand.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} options={{ title: brand.name }} />
          <Stack.Screen name="Students" component={StudentsScreen} />
          <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
          <Stack.Screen name="Finance" component={FinanceScreen} />
          <Stack.Screen name="Fees" component={FeesScreen} />
          <Stack.Screen name="Invoice" component={InvoiceDetailScreen} />
          <Stack.Screen name="Receipt" component={ReceiptScreen} />
          <Stack.Screen name="Attendance" component={AttendanceScreen} />
          <Stack.Screen name="Timetable" component={TimetableScreen} />
          <Stack.Screen name="Exams" component={ExamsScreen} />
          <Stack.Screen name="ExamDetail" component={ExamDetailScreen} options={{ title: 'Exam' }} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="EnterMarks" component={EnterMarksScreen} options={{ title: 'Enter marks' }} />
          <Stack.Screen name="Homework" component={HomeworkScreen} />
          <Stack.Screen name="HomeworkDetail" component={HomeworkDetailScreen} options={{ title: 'Homework' }} />
          <Stack.Screen name="Materials" component={MaterialsScreen} />
          <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
          <Stack.Screen name="Events" component={EventsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Documents" component={DocumentsScreen} />
          <Stack.Screen name="Users" component={UsersScreen} />
          <Stack.Screen name="Directory" component={DirectoryScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
