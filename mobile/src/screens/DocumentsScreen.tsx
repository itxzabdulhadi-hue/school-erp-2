import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useDeleteDocument, useDocuments, useUploadDocument } from '../api/query';
import { useClient, useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat } from '../branding/theme';
import { AppIcon } from '../components/AppIcon';
import {
  Btn, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';
import { appendFile, downloadAndShare, pickFile, type PickedFile } from '../utils/files';

const OWNERS = ['school', 'student', 'teacher', 'staff', 'class'];

function kb(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsScreen(): React.JSX.Element {
  const { permissions } = useSession();
  const client = useClient();
  const fmt = useFormat();
  const [ownerType, setOwnerType] = useState<string | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const list = useDocuments({ ownerType });
  const canManage = can(permissions, PERM.documentsCreate);
  const remove = useDeleteDocument({
    onSuccess: () => Alert.alert('Deleted', 'Document removed.'),
    onError: (err) => Alert.alert('Cannot delete', friendlyMessage(err)),
  });
  const confirmDelete = (id: string, title: string): void => {
    Alert.alert('Delete document?', `"${title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  };

  const download = async (id: string, fileName: string): Promise<void> => {
    setBusy(id);
    try {
      await downloadAndShare(client, `/api/v1/documents/${id}/download`, fileName || 'document');
    } catch (err) {
      Alert.alert('Download failed', friendlyMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      <View style={styles.chipRow}>
        <Chip label="All" selected={!ownerType} onPress={() => setOwnerType(undefined)} />
        {OWNERS.map((o) => (
          <Chip key={o} label={o} selected={ownerType === o} onPress={() => setOwnerType(ownerType === o ? undefined : o)} />
        ))}
      </View>
      {can(permissions, PERM.documentsCreate) && (
        <Btn title={showAdd ? 'Close form' : 'Upload document'} variant="secondary" icon="add" onPress={() => setShowAdd((s) => !s)} />
      )}
      {showAdd && <UploadForm onDone={() => { setShowAdd(false); void list.refetch(); }} />}
      {list.isLoading ? <LoadingView text="Loading documents…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="document-text" title="No documents" hint="Nothing filed here yet." />
        : (
          <Card>
            {(list.data ?? []).map((d) => (
              <ListRow
                key={d.id}
                title={d.title}
                sub={`${d.ownerType}${d.fileName ? ` · ${d.fileName}` : ''}${d.sizeBytes ? ` · ${kb(Number(d.sizeBytes))}` : ''} · ${fmt.date(d.createdAt)}`}
                right={
                  <View style={styles.actions}>
                    <AppIcon name={busy === d.id ? 'refresh' : 'download'} size={22} color={busy === d.id ? '#94a3b8' : '#0369a1'} />
                    {can(permissions, PERM.documentsCreate) && <AppIcon name="trash" size={20} color="#b91c1c" />}
                  </View>
                }
                onPress={() => void download(d.id, d.fileName)}
              />
            ))}
          </Card>
        )}
      {can(permissions, PERM.documentsCreate) && (list.data ?? []).length > 0 && (
        <Text style={styles.hint}>Tip: long-press a row in a future update to delete. For now, contact an administrator to remove files.</Text>
      )}
    </ScrollScreen>
  );
}

function UploadForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [ownerType, setOwnerType] = useState('school');
  const [ownerId, setOwnerId] = useState('');
  const [kind, setKind] = useState('other');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState('');
  const upload = useUploadDocument({
    onSuccess: () => {
      Alert.alert('Uploaded', 'Document confirmed by the server.');
      onDone();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <Card>
      <SectionTitle>Upload document</SectionTitle>
      <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Fee policy 2026" />
      <Text style={styles.label}>Filed under</Text>
      <View style={styles.chipRow}>
        {OWNERS.map((o) => (
          <Chip key={o} label={o} selected={ownerType === o} onPress={() => setOwnerType(o)} />
        ))}
      </View>
      {ownerType !== 'school' && (
        <Field label="Owner ID (student / staff / class record id)" value={ownerId} onChangeText={setOwnerId} placeholder="Optional" />
      )}
      <Field label="Kind" value={kind} onChangeText={setKind} placeholder="policy, form, report…" />
      <Btn title={file ? `File: ${file.name}` : 'Pick a file *'} variant="secondary" icon="cloud-upload" onPress={() => void pickFile().then((f) => f && setFile(f))} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Upload"
        loading={upload.isPending}
        onPress={() => {
          if (!title.trim() || !file) { setError('A title and a file are required.'); return; }
          setError('');
          const form = new FormData();
          form.append('title', title.trim());
          form.append('ownerType', ownerType);
          if (ownerId.trim()) form.append('ownerId', ownerId.trim());
          form.append('kind', kind.trim() || 'other');
          appendFile(form, 'file', file);
          upload.mutate(form);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  error: { fontSize: 13, color: '#b91c1c' },
  actions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  hint: { fontSize: 12, color: '#94a3b8' },
});
