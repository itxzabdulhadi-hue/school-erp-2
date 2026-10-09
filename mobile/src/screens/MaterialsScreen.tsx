import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useClasses, useMaterials, useSubjects, useUploadMaterial } from '../api/query';
import { useClient, useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat } from '../branding/theme';
import {
  Btn, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';
import { appendFile, downloadAndShare, pickFile, type PickedFile } from '../utils/files';

const KINDS = ['document', 'video', 'link', 'audio', 'other'];

export function MaterialsScreen(): React.JSX.Element {
  const { user, permissions } = useSession();
  const client = useClient();
  const fmt = useFormat();
  const [kind, setKind] = useState<string | undefined>(undefined);
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const isStudent = user?.role === 'student';
  const classes = useClasses();
  const list = useMaterials({ kind, classId: isStudent ? undefined : classId });

  const open = async (id: string, url: string, fileName: string): Promise<void> => {
    if (url) {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Cannot open link', 'This device could not open the URL.');
      }
      return;
    }
    setBusy(id);
    try {
      await downloadAndShare(client, `/api/v1/materials/${id}/download`, fileName || 'material');
    } catch (err) {
      Alert.alert('Download failed', friendlyMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      <View style={styles.chipRow}>
        <Chip label="All types" selected={!kind} onPress={() => setKind(undefined)} />
        {KINDS.map((k) => (
          <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(kind === k ? undefined : k)} />
        ))}
      </View>
      {!isStudent && (
        <View style={styles.chipRow}>
          <Chip label="All classes" selected={!classId} onPress={() => setClassId(undefined)} />
          {(classes.data ?? []).map((c) => (
            <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => setClassId(classId === c.id ? undefined : c.id)} />
          ))}
        </View>
      )}
      {can(permissions, PERM.materialsCreate) && (
        <Btn title={showAdd ? 'Close form' : 'Share material'} variant="secondary" icon="add" onPress={() => setShowAdd((s) => !s)} />
      )}
      {showAdd && <ShareForm onDone={() => { setShowAdd(false); void list.refetch(); }} />}
      {list.isLoading ? <LoadingView text="Loading materials…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="folder" title="No materials" hint="Nothing shared here yet." />
        : (
          <Card>
            {(list.data ?? []).map((m) => (
              <ListRow
                key={m.id}
                title={m.title}
                sub={`${m.kind}${m.subjectName ? ` · ${m.subjectName}` : ''}${m.className ? ` · ${m.className}` : ''} · ${fmt.date(m.createdAt)}`}
                onPress={() => void open(m.id, m.url, m.fileName)}
              />
            ))}
          </Card>
        )}
    </ScrollScreen>
  );
}

function ShareForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const classes = useClasses();
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('document');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState('');
  const subjects = useSubjects(classId || undefined);
  const upload = useUploadMaterial({
    onSuccess: () => {
      Alert.alert('Shared', 'Material confirmed by the server.');
      onDone();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <Card>
      <SectionTitle>Share material</SectionTitle>
      <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Fractions worksheet" />
      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {KINDS.map((k) => (
          <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <Text style={styles.label}>Class (optional)</Text>
      <View style={styles.chipRow}>
        <Chip label="All" selected={!classId} onPress={() => { setClassId(''); setSubjectId(''); }} />
        {(classes.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => { setClassId(classId === c.id ? '' : c.id); setSubjectId(''); }} />
        ))}
      </View>
      {classId ? (
        <>
          <Text style={styles.label}>Subject (optional)</Text>
          <View style={styles.chipRow}>
            {(subjects.data ?? []).map((s) => (
              <Chip key={s.id} label={s.name} selected={subjectId === s.id} onPress={() => setSubjectId(subjectId === s.id ? '' : s.id)} />
            ))}
          </View>
        </>
      ) : null}
      <Field label="Link URL (if no file)" value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="https://…" />
      <Btn title={file ? `File: ${file.name}` : 'Pick a file'} variant="secondary" icon="cloud-upload" onPress={() => void pickFile().then((f) => f && setFile(f))} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Share"
        loading={upload.isPending}
        onPress={() => {
          if (!title.trim()) { setError('A title is required.'); return; }
          if (!file && !url.trim()) { setError('Attach a file or provide a URL.'); return; }
          setError('');
          const form = new FormData();
          form.append('title', title.trim());
          form.append('kind', kind);
          if (classId) form.append('classId', classId);
          if (subjectId) form.append('subjectId', subjectId);
          if (url.trim()) form.append('url', url.trim());
          if (file) appendFile(form, 'file', file);
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
});
