import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useStaffList, useTeachers } from '../api/query';
import { AppIcon } from '../components/AppIcon';
import {
  Avatar, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';

export function DirectoryScreen(): React.JSX.Element {
  const [tab, setTab] = useState<'teachers' | 'staff'>('teachers');
  const [search, setSearch] = useState('');
  const teachers = useTeachers();
  const staff = useStaffList();
  const active = tab === 'teachers' ? teachers : staff;
  const q = search.trim().toLowerCase();
  const rows = ((active.data ?? []) as { id: string; firstName: string; lastName: string; phone: string; email: string; department?: string; designation?: string; qualification?: string }[])
    .filter((p) => !q || `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q));

  const call = (phone: string): void => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => undefined);
  };

  return (
    <ScrollScreen refreshing={active.isFetching} onRefresh={() => void active.refetch()}>
      <View style={styles.chipRow}>
        <Chip label="Teachers" selected={tab === 'teachers'} onPress={() => setTab('teachers')} />
        <Chip label="Staff" selected={tab === 'staff'} onPress={() => setTab('staff')} />
      </View>
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name or email…" autoCapitalize="none" />
      {active.isLoading ? <LoadingView />
        : active.isError ? <ErrorView message={friendlyMessage(active.error)} onRetry={() => void active.refetch()} />
        : rows.length === 0 ? <EmptyState icon="briefcase" title="Nobody found" />
        : (
          <>
            <SectionTitle>{tab === 'teachers' ? 'Teachers' : 'Staff'} ({rows.length})</SectionTitle>
            <Card>
              {rows.map((p) => (
                <ListRow
                  key={p.id}
                  title={`${p.firstName} ${p.lastName}`}
                  sub={[p.designation || p.qualification, p.phone, p.email].filter(Boolean).join(' · ') || '—'}
                  left={<Avatar name={`${p.firstName} ${p.lastName}`} />}
                  right={p.phone ? <AppIcon name="chevron-forward" size={20} color="#94a3b8" /> : undefined}
                  onPress={p.phone ? () => call(p.phone) : undefined}
                />
              ))}
            </Card>
          </>
        )}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 8 },
});
