import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useCreateEvent, useEvents } from '../api/query';
import { useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat } from '../branding/theme';
import {
  Btn, Card, Chip, EmptyState, ErrorView, Field,
  LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';

const AUDIENCES = ['all', 'student', 'teacher', 'staff'];
const todayISO = (): string => new Date().toISOString().slice(0, 10);

export function EventsScreen(): React.JSX.Element {
  const { permissions } = useSession();
  const fmt = useFormat();
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const list = useEvents(upcomingOnly ? { from: todayISO() } : undefined);

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      <View style={styles.chipRow}>
        <Chip label="Upcoming" selected={upcomingOnly} onPress={() => setUpcomingOnly(true)} />
        <Chip label="All" selected={!upcomingOnly} onPress={() => setUpcomingOnly(false)} />
      </View>
      {can(permissions, PERM.eventsCreate) && (
        <Btn title={showAdd ? 'Close form' : 'New event'} variant="secondary" icon="add" onPress={() => setShowAdd((s) => !s)} />
      )}
      {showAdd && <ComposeForm onDone={() => { setShowAdd(false); void list.refetch(); }} />}
      {list.isLoading ? <LoadingView text="Loading events…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="calendar" title="No events" hint="Nothing on the calendar." />
        : (list.data ?? []).map((e) => (
          <Card key={e.id}>
            <Text style={styles.title}>{e.title}</Text>
            <Text style={styles.date}>
              {fmt.date(e.date)}
              {e.startTime ? ` · ${fmt.time(e.startTime)}${e.endTime ? ` – ${fmt.time(e.endTime)}` : ''}` : ''}
              {e.location ? ` · ${e.location}` : ''}
            </Text>
            {e.description ? <Text style={styles.body}>{e.description}</Text> : null}
          </Card>
        ))}
    </ScrollScreen>
  );
}

function ComposeForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO());
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('all');
  const [error, setError] = useState('');
  const create = useCreateEvent({
    onSuccess: () => {
      Alert.alert('Created', 'Event confirmed by the server.');
      onDone();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <Card>
      <SectionTitle>New event</SectionTitle>
      <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Annual Sports Day" />
      <Field label="Date (YYYY-MM-DD) *" value={date} onChangeText={setDate} placeholder="2026-11-14" />
      <Field label="Location" value={location} onChangeText={setLocation} placeholder="Main Ground" />
      <Field label="Details" value={description} onChangeText={setDescription} multiline placeholder="Programme…" />
      <Text style={styles.label}>Audience</Text>
      <View style={styles.chipRow}>
        {AUDIENCES.map((a) => (
          <Chip key={a} label={a} selected={audience === a} onPress={() => setAudience(a)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Create event"
        loading={create.isPending}
        onPress={() => {
          if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            setError('A title and a valid date are required.');
            return;
          }
          setError('');
          create.mutate({ title: title.trim(), date, location, description, audience });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  date: { fontSize: 13, color: '#0369a1', marginTop: 2, fontWeight: '600' },
  body: { fontSize: 15, color: '#334155', marginTop: 8, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 13, color: '#b91c1c' },
});
