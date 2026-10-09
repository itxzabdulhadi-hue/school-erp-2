import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useUsers } from '../api/query';
import { useApi } from '../auth/session';
import {
  Badge, Btn, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';

const ROLES = ['admin', 'teacher', 'student', 'staff'];

export function UsersScreen(): React.JSX.Element {
  const [showAdd, setShowAdd] = useState(false);
  const list = useUsers();

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      <Btn title={showAdd ? 'Close form' : 'Add user'} variant="secondary" icon="add" onPress={() => setShowAdd((s) => !s)} />
      {showAdd && <AddUserForm onDone={() => { setShowAdd(false); void list.refetch(); }} />}
      {list.isLoading ? <LoadingView text="Loading users…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="person" title="No users" />
        : (
          <Card>
            {(list.data ?? []).map((u) => (
              <ListRow
                key={u.id}
                title={u.name}
                sub={`${u.email} · ${u.role}`}
                right={<View style={styles.badges}>
                  {u.isActive === false && <Badge tone="neutral">OFF</Badge>}
                  <ToggleActive id={u.id} active={u.isActive !== false} />
                </View>}
              />
            ))}
          </Card>
        )}
    </ScrollScreen>
  );
}

function ToggleActive({ id, active }: { id: string; active: boolean }): React.JSX.Element {
  const api = useApi();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => api.users.update(id, { isActive: !active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => Alert.alert('Failed', friendlyMessage(err)),
  });
  return (
    <Chip label={active ? 'Deactivate' : 'Activate'} selected={!active} onPress={() => toggle.mutate()} />
  );
}

function AddUserForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const api = useApi();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: () => api.users.create({ name: name.trim(), email: email.trim(), password, role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      Alert.alert('Created', 'User confirmed by the server. Link a profile from the web console for scoped access.');
      onDone();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <Card>
      <SectionTitle>New user</SectionTitle>
      <Field label="Full name *" value={name} onChangeText={setName} placeholder="New Teacher" />
      <Field label="Email *" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="user@school.edu" />
      <Field label="Temporary password (min 8) *" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
      <Text style={styles.label}>Role</Text>
      <View style={styles.chipRow}>
        {ROLES.map((r) => (
          <Chip key={r} label={r} selected={role === r} onPress={() => setRole(r)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Create user"
        loading={create.isPending}
        onPress={() => {
          if (!name.trim() || !email.trim() || password.length < 8) {
            setError('Name, email and an 8+ character password are required.');
            return;
          }
          setError('');
          create.mutate();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 13, color: '#b91c1c' },
  badges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
});
