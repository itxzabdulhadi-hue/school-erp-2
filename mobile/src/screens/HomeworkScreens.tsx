import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import {
  useClasses, useCreateHomework, useHomework, useHomeworkDetail,
  useReviewSubmission, useSubjects, useSubmissions, useSubmitHomework,
} from '../api/query';
import { useClient, useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat } from '../branding/theme';
import {
  Badge, Btn, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';
import { appendFile, downloadAndShare, pickFile, type PickedFile } from '../utils/files';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

/* ---------------------------------- list ----------------------------------- */

export function HomeworkScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const { user, permissions } = useSession();
  const fmt = useFormat();
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const isStudent = user?.role === 'student';
  const classes = useClasses();
  const list = useHomework(isStudent ? undefined : { classId });

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      {!isStudent && (
        <View style={styles.chipRow}>
          <Chip label="All classes" selected={!classId} onPress={() => setClassId(undefined)} />
          {(classes.data ?? []).map((c) => (
            <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => setClassId(classId === c.id ? undefined : c.id)} />
          ))}
        </View>
      )}
      {can(permissions, PERM.homeworkCreate) && (
        <Btn title={showAdd ? 'Close form' : 'Assign homework'} variant="secondary" icon="add" onPress={() => setShowAdd((s) => !s)} />
      )}
      {showAdd && <AssignForm onDone={() => { setShowAdd(false); void list.refetch(); }} />}
      {list.isLoading ? <LoadingView text="Loading homework…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="book" title="No homework" hint="Nothing assigned here yet." />
        : (
          <Card>
            {(list.data ?? []).map((h) => (
              <ListRow
                key={h.id}
                title={h.title}
                sub={`${h.subjectName} · ${h.className} · Due ${fmt.date(h.dueDate)}${h.submissionCount !== undefined ? ` · ${h.submissionCount} submitted` : ''}`}
                right={h.dueDate < todayISO() && h.status === 'active' ? <Badge tone="danger">OVERDUE</Badge> : undefined}
                onPress={() => nav.navigate('HomeworkDetail', { id: h.id })}
              />
            ))}
          </Card>
        )}
    </ScrollScreen>
  );
}

function AssignForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const classes = useClasses();
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(plusDays(7));
  const [error, setError] = useState('');
  const subjects = useSubjects(classId || undefined);
  const create = useCreateHomework({
    onSuccess: () => {
      Alert.alert('Assigned', 'Homework confirmed by the server.');
      onDone();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <Card>
      <SectionTitle>New homework</SectionTitle>
      <Text style={styles.label}>Class *</Text>
      <View style={styles.chipRow}>
        {(classes.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => { setClassId(c.id); setSubjectId(''); }} />
        ))}
      </View>
      <Text style={styles.label}>Subject *</Text>
      <View style={styles.chipRow}>
        {(subjects.data ?? []).map((s) => (
          <Chip key={s.id} label={s.name} selected={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
        ))}
      </View>
      <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Chapter 5 exercises" />
      <Field label="Instructions" value={description} onChangeText={setDescription} multiline placeholder="What should students do?" />
      <Field label="Due date (YYYY-MM-DD) *" value={dueDate} onChangeText={setDueDate} placeholder="2026-10-20" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Assign"
        loading={create.isPending}
        onPress={() => {
          if (!classId || !subjectId || !title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            setError('Class, subject, title and a valid due date are required.');
            return;
          }
          setError('');
          create.mutate({ classId, subjectId, title: title.trim(), description, assignedDate: todayISO(), dueDate });
        }}
      />
    </Card>
  );
}

/* --------------------------------- detail ---------------------------------- */

export function HomeworkDetailScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'HomeworkDetail'>>();
  const { user } = useSession();
  const fmt = useFormat();
  const detail = useHomeworkDetail(route.params.id);

  if (detail.isLoading) return <LoadingView text="Loading homework…" />;
  if (detail.isError || !detail.data) {
    return (
      <ScrollScreen>
        <ErrorView message={friendlyMessage(detail.error)} onRetry={() => void detail.refetch()} />
      </ScrollScreen>
    );
  }
  const h = detail.data;

  return (
    <ScrollScreen refreshing={detail.isFetching} onRefresh={() => void detail.refetch()}>
      <Card>
        <Text style={styles.title}>{h.title}</Text>
        <Text style={styles.sub}>{h.subjectName} · {h.className}{h.sectionName ? `-${h.sectionName}` : ''}</Text>
        <Text style={styles.sub}>Assigned {fmt.date(h.assignedDate)} · Due {fmt.date(h.dueDate)}</Text>
        {h.description ? <Text style={styles.body}>{h.description}</Text> : null}
        {!!h.attachmentPath && <AttachmentButton homeworkId={h.id} />}
      </Card>
      {user?.role === 'student'
        ? <SubmitPanel homeworkId={h.id} />
        : <SubmissionsPanel homeworkId={h.id} />}
    </ScrollScreen>
  );
}

function AttachmentButton({ homeworkId }: { homeworkId: string }): React.JSX.Element {
  const client = useClient();
  const [busy, setBusy] = useState(false);
  return (
    <Btn
      title="Download attachment" variant="secondary" icon="download" loading={busy}
      onPress={() => {
        setBusy(true);
        downloadAndShare(client, `/api/v1/homework/${homeworkId}/attachment`, 'homework-attachment')
          .catch((err: unknown) => Alert.alert('Download failed', friendlyMessage(err)))
          .finally(() => setBusy(false));
      }}
    />
  );
}

function SubmitPanel({ homeworkId }: { homeworkId: string }): React.JSX.Element {
  const detail = useHomeworkDetail(homeworkId);
  const [text, setText] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState('');
  const submit = useSubmitHomework(homeworkId, {
    onSuccess: () => {
      Alert.alert('Submitted', 'Your work was confirmed by the server.');
      setText('');
      setFile(null);
      void detail.refetch();
    },
    onError: (err) => setError(friendlyMessage(err)),
  });
  const mine = detail.data?.mySubmission;

  return (
    <>
      {mine && (
        <>
          <SectionTitle>My submission</SectionTitle>
          <Card>
            <Text style={styles.sub}>Submitted {mine.submittedAt ? new Date(mine.submittedAt).toLocaleString() : ''} · {mine.status}</Text>
            {mine.text ? <Text style={styles.body}>{mine.text}</Text> : null}
            {mine.feedback ? <Text style={styles.feedback}>Feedback: {mine.feedback}{mine.score !== null && mine.score !== undefined ? ` (${mine.score})` : ''}</Text> : null}
          </Card>
        </>
      )}
      <SectionTitle>{mine ? 'Resubmit' : 'Submit work'}</SectionTitle>
      <Card>
        <Field label="Answer / notes" value={text} onChangeText={setText} multiline placeholder="Type your work or notes…" />
        <Btn
          title={file ? `Attached: ${file.name}` : 'Attach a file (optional)'}
          variant="secondary" icon="cloud-upload"
          onPress={() => void pickFile().then((f) => f && setFile(f))}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          title="Submit"
          loading={submit.isPending}
          onPress={() => {
            if (!text.trim() && !file) { setError('Write something or attach a file.'); return; }
            setError('');
            const form = new FormData();
            form.append('text', text.trim());
            if (file) appendFile(form, 'file', file);
            submit.mutate(form);
          }}
        />
      </Card>
    </>
  );
}

function SubmissionsPanel({ homeworkId }: { homeworkId: string }): React.JSX.Element {
  const list = useSubmissions(homeworkId);
  const [open, setOpen] = useState<string | null>(null);

  if (list.isLoading) return <LoadingView />;
  if (list.isError) return <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />;
  const subs = list.data ?? [];
  if (subs.length === 0) return <EmptyState icon="book" title="No submissions yet" />;

  return (
    <>
      <SectionTitle>Submissions ({subs.length})</SectionTitle>
      <Card>
        {subs.map((s) => (
          <View key={s.id}>
            <ListRow
              title={s.studentName ?? 'Student'}
              sub={`${s.submittedAt ? new Date(s.submittedAt).toLocaleString() : ''} · ${s.status}${s.score !== null && s.score !== undefined ? ` · ${s.score}` : ''}`}
              right={s.status === 'reviewed' ? <Badge tone="success">REVIEWED</Badge> : <Badge tone="warning">PENDING</Badge>}
              onPress={() => setOpen(open === s.id ? null : s.id)}
            />
            {open === s.id && <ReviewForm submissionId={s.id} text={s.text} feedback={s.feedback} hasFile={s.hasFile} />}
          </View>
        ))}
      </Card>
    </>
  );
}

function ReviewForm({ submissionId, text, feedback, hasFile }: {
  submissionId: string; text: string; feedback: string; hasFile: boolean;
}): React.JSX.Element {
  const client = useClient();
  const [fb, setFb] = useState(feedback ?? '');
  const [score, setScore] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const review = useReviewSubmission({
    onSuccess: () => Alert.alert('Saved', 'Review confirmed by the server.'),
    onError: (err) => setError(friendlyMessage(err)),
  });

  return (
    <View style={styles.review}>
      {text ? <Text style={styles.body}>{text}</Text> : null}
      {hasFile && (
        <Btn
          title="Download attached file" variant="ghost" icon="download" loading={busy}
          onPress={() => {
            setBusy(true);
            downloadAndShare(client, `/api/v1/submissions/${submissionId}/file`, 'submission-file')
              .catch((err: unknown) => Alert.alert('Download failed', friendlyMessage(err)))
              .finally(() => setBusy(false));
          }}
        />
      )}
      <Field label="Feedback" value={fb} onChangeText={setFb} multiline placeholder="Good effort…" />
      <Field label="Score (optional)" value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="9" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Save review"
        loading={review.isPending}
        onPress={() => {
          const n = score.trim() === '' ? null : Number(score);
          if (n !== null && (!Number.isFinite(n) || n < 0)) { setError('Score must be 0 or above.'); return; }
          setError('');
          review.mutate({ id: submissionId, body: { feedback: fb, score: n, status: 'reviewed' } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  error: { fontSize: 13, color: '#b91c1c' },
  title: { fontSize: 19, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  body: { fontSize: 15, color: '#0f172a', marginTop: 8, lineHeight: 22 },
  feedback: { fontSize: 14, color: '#0369a1', marginTop: 8 },
  review: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8, gap: 8 },
});
