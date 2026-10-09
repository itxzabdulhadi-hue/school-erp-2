import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useBroadcast, useNotifications, useReadAllNotifications, useReadNotification } from '../api/query';
import { useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import {
  Badge, Btn, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';

const AUDIENCES = ['all', 'student', 'teacher', 'staff'];

export function NotificationsScreen(): React.JSX.Element {
  const { permissions } = useSession();
  const [showAdd, setShowAdd] = useState(false);
  const list = useNotifications();
  const read = useReadNotification();
  const readAll = useReadAllNotifications();

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      {can(permissions, PERM.notificationsBroadcast) && (
        <Btn title={showAdd ? 'Close form' : 'Broadcast alert'} variant="secondary" icon="add" onPress={() => setShowAdd((s) => !s)} />
      )}
      {showAdd && <BroadcastForm onDone={() => { setShowAdd(false); void list.refetch(); }} />}
      {(list.data?.unreadCount ?? 0) > 0 && (
        <Btn title={`Mark all read (${list.data?.unreadCount})`} variant="ghost" loading={readAll.isPending} onPress={() => readAll.mutate()} />
      )}
      {list.isLoading ? <LoadingView text="Loading notifications…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data?.items ?? []).length === 0 ? <EmptyState icon="notifications" title="All caught up" hint="No notifications right now." />
        : (
          <Card>
            {(list.data?.items ?? []).map((n) => (
              <ListRow
                key={n.id}
                title={n.title}
                sub={`${n.body}${n.createdAt ? ` · ${new Date(n.createdAt).toLocaleString()}` : ''}`}
                right={!n.isRead ? <Badge tone="info">NEW</Badge> : undefined}
                onPress={() => { if (!n.isRead) read.mutate(n.id); }}
              />
            ))}
          </Card>
        )}
    </ScrollScreen>
  );
}

function BroadcastForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [error, setError] = useState('');
  const broadcast = useBroadcast({
    onSuccess: (d) => {
      Alert.alert('Sent', `Delivered to ${d.delivered} account(s).`);
      onDone();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <Card>
      <SectionTitle>Broadcast alert</SectionTitle>
      <Field label="Title *" value={title} onChangeText={setTitle} placeholder="School closed tomorrow" />
      <Field label="Message" value={body} onChangeText={setBody} multiline placeholder="Details…" />
      <Text style={styles.label}>Audience</Text>
      <View style={styles.chipRow}>
        {AUDIENCES.map((a) => (
          <Chip key={a} label={a} selected={audience === a} onPress={() => setAudience(a)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Send broadcast"
        loading={broadcast.isPending}
        onPress={() => {
          if (!title.trim()) { setError('A title is required.'); return; }
          setError('');
          broadcast.mutate({ title: title.trim(), body, audience });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 13, color: '#b91c1c' },
});
