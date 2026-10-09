import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useAnnouncements, useCreateAnnouncement } from '../api/query';
import { useApi, useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat } from '../branding/theme';
import {
  Badge, Btn, Card, Chip, EmptyState, ErrorView, Field,
  LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';

const AUDIENCES = ['all', 'student', 'teacher', 'staff'];

export function AnnouncementsScreen(): React.JSX.Element {
  const { permissions } = useSession();
  const fmt = useFormat();
  const [showAdd, setShowAdd] = useState(false);
  const list = useAnnouncements();

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      {can(permissions, PERM.announcementsCreate) && (
        <Btn title={showAdd ? 'Close form' : 'New announcement'} variant="secondary" icon="add" onPress={() => setShowAdd((s) => !s)} />
      )}
      {showAdd && <ComposeForm onDone={() => { setShowAdd(false); void list.refetch(); }} />}
      {list.isLoading ? <LoadingView text="Loading announcements…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="megaphone" title="No announcements" hint="Check back later." />
        : (list.data ?? []).map((a) => (
          <Card key={a.id}>
            <View style={styles.head}>
              <Text style={styles.title}>{a.title}</Text>
              {a.priority === 'urgent' || a.priority === 'high'
                ? <Badge tone={a.priority === 'urgent' ? 'danger' : 'warning'}>{a.priority.toUpperCase()}</Badge>
                : null}
            </View>
            <Text style={styles.date}>{fmt.date(a.publishDate)} · {a.audience}</Text>
            {a.body ? <Text style={styles.body}>{a.body}</Text> : null}
            {can(permissions, PERM.announcementsCreate) && <DeleteButton id={a.id} />}
          </Card>
        ))}
    </ScrollScreen>
  );
}

function ComposeForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [priority, setPriority] = useState('normal');
  const [error, setError] = useState('');
  const create = useCreateAnnouncement({
    onSuccess: () => {
      Alert.alert('Published', 'Announcement confirmed by the server.');
      onDone();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <Card>
      <SectionTitle>New announcement</SectionTitle>
      <Field label="Title *" value={title} onChangeText={setTitle} placeholder="PTM on Saturday" />
      <Field label="Details" value={body} onChangeText={setBody} multiline placeholder="Write the announcement…" />
      <Text style={styles.label}>Audience</Text>
      <View style={styles.chipRow}>
        {AUDIENCES.map((a) => (
          <Chip key={a} label={a} selected={audience === a} onPress={() => setAudience(a)} />
        ))}
      </View>
      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipRow}>
        {['low', 'normal', 'high', 'urgent'].map((p) => (
          <Chip key={p} label={p} selected={priority === p} onPress={() => setPriority(p)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Publish"
        loading={create.isPending}
        onPress={() => {
          if (!title.trim()) { setError('A title is required.'); return; }
          setError('');
          create.mutate({ title: title.trim(), body, audience, priority });
        }}
      />
    </Card>
  );
}

function DeleteButton({ id }: { id: string }): React.JSX.Element {
  const api = useApi();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api.announcements.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['announcements'] }),
    onError: (err) => Alert.alert('Cannot delete', friendlyMessage(err)),
  });
  return (
    <Btn
      title="Delete" variant="ghost" loading={del.isPending}
      onPress={() => Alert.alert('Delete?', 'This removes the announcement for everyone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
      ])}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  date: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  body: { fontSize: 15, color: '#334155', marginTop: 8, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 13, color: '#b91c1c' },
});
