import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useAttendanceSummary, useClasses, useInvoices, useStudent, useStudents } from '../api/query';
import { useApi, useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat, useTheme } from '../branding/theme';
import { AppIcon } from '../components/AppIcon';
import {
  Avatar, Badge, Btn, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ---------------------------------- list ----------------------------------- */

export function StudentsScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const { permissions } = useSession();
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const classes = useClasses();
  const list = useStudents({ search: search || undefined, classId });

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name, admission no, ID…" autoCapitalize="none" />
      <ScrollRow>
        <Chip label="All classes" selected={!classId} onPress={() => setClassId(undefined)} />
        {(classes.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => setClassId(classId === c.id ? undefined : c.id)} />
        ))}
      </ScrollRow>
      {can(permissions, PERM.studentsCreate) && (
        <Btn title={showAdd ? 'Close form' : 'Add student'} variant="secondary" icon="add" onPress={() => setShowAdd((s) => !s)} />
      )}
      {showAdd && <AddStudentForm onDone={() => { setShowAdd(false); void list.refetch(); }} />}
      {list.isLoading ? <LoadingView text="Loading students…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="people" title="No students found" hint="Try a different search or class." />
        : (
          <Card>
            {(list.data ?? []).map((s) => (
              <ListRow
                key={s.id}
                title={`${s.firstName} ${s.lastName}`}
                sub={`${s.className ?? '—'}${s.sectionName ? `-${s.sectionName}` : ''} · ${s.admissionNo}`}
                left={<Avatar name={`${s.firstName} ${s.lastName}`} />}
                onPress={() => nav.navigate('StudentDetail', { id: s.id })}
              />
            ))}
          </Card>
        )}
    </ScrollScreen>
  );
}

function ScrollRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.chipRow}>{children}</View>;
}

function AddStudentForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const api = useApi();
  const qc = useQueryClient();
  const classes = useClasses();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: () => api.students.create({ firstName, lastName, classId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['students'] });
      Alert.alert('Saved', 'The student was created on the server.');
      onDone();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <Card>
      <SectionTitle>New student</SectionTitle>
      <Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="Ahmed" />
      <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Raza" />
      <Text style={styles.label}>Class *</Text>
      <View style={styles.chipRow}>
        {(classes.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => setClassId(c.id)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Create student"
        loading={create.isPending}
        onPress={() => {
          if (!firstName.trim() || !lastName.trim() || !classId) {
            setError('First name, last name and class are required.');
            return;
          }
          create.mutate();
        }}
      />
    </Card>
  );
}

/* --------------------------------- detail ---------------------------------- */

export function StudentDetailScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'StudentDetail'>>();
  const nav = useNavigation<Nav>();
  const { user } = useSession();
  const fmt = useFormat();
  const id = route.params?.id ?? '';
  const detail = useStudent(id);
  const att = useAttendanceSummary(id);
  const invoices = useInvoices({ studentId: id || undefined }, { enabled: id.length > 0 });

  if (detail.isLoading) return <LoadingView text="Loading profile…" />;
  if (detail.isError || !detail.data) {
    return (
      <ScrollScreen>
        <ErrorView message={friendlyMessage(detail.error)} onRetry={() => void detail.refetch()} />
      </ScrollScreen>
    );
  }
  const s = detail.data;
  const due = (invoices.data ?? []).filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((t, i) => t + Number(i.balance), 0);

  return (
    <ScrollScreen refreshing={detail.isFetching} onRefresh={() => { void detail.refetch(); void att.refetch(); void invoices.refetch(); }}>
      <Card>
        <View style={styles.head}>
          <Avatar name={`${s.firstName} ${s.lastName}`} size={60} />
          <View style={styles.headMeta}>
            <Text style={styles.name}>{s.firstName} {s.lastName}</Text>
            <Text style={styles.sub}>{s.className ?? '—'}{s.sectionName ? `-${s.sectionName}` : ''} · Roll {s.rollNo || '—'}</Text>
            <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status.toUpperCase()}</Badge>
          </View>
        </View>
      </Card>

      <SectionTitle>Record</SectionTitle>
      <Card>
        <InfoRow label="Student ID" value={s.studentIdCode || '—'} />
        <InfoRow label="Admission no" value={s.admissionNo || '—'} />
        <InfoRow label="Date of birth" value={fmt.date(s.dob)} />
        <InfoRow label="Admitted" value={fmt.date(s.admissionDate)} />
        <InfoRow label="Phone" value={s.phone || '—'} />
        <InfoRow label="Address" value={s.address || '—'} />
      </Card>

      <SectionTitle>Attendance</SectionTitle>
      <Card>
        {att.data
          ? <Text style={styles.big}>{att.data.pct}% <Text style={styles.sub}>· {att.data.present}/{att.data.total} present</Text></Text>
          : <Text style={styles.sub}>No attendance yet.</Text>}
      </Card>

      <SectionTitle>Fees</SectionTitle>
      <Card onPress={user?.role === 'student'
        ? () => nav.navigate('Fees')
        : () => nav.navigate('Finance')}
      >
        <View style={styles.feeRow}>
          <AppIcon name="card" size={22} color="#334155" />
          <Text style={styles.feeText}>Outstanding: {fmt.money(due)}</Text>
          <AppIcon name="chevron-forward" size={20} color="#94a3b8" />
        </View>
      </Card>
    </ScrollScreen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: -4 },
  error: { fontSize: 13, color: '#b91c1c' },
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  headMeta: { flex: 1, gap: 4 },
  name: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 14, color: '#64748b' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#0f172a', maxWidth: '60%', textAlign: 'right' },
  big: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feeText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
});
