import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useClasses, useExam, useExams, useResults, useSaveMarksBulk, useStudents } from '../api/query';
import { useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat } from '../branding/theme';
import {
  Badge, Btn, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* --------------------------------- exams ----------------------------------- */

export function ExamsScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const fmt = useFormat();
  const list = useExams();

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      {list.isLoading ? <LoadingView text="Loading exams…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="time" title="No exams" hint="No examinations scheduled yet." />
        : (
          <Card>
            {(list.data ?? []).map((e) => (
              <ListRow
                key={e.id}
                title={e.name}
                sub={`${fmt.date(e.startDate)} – ${fmt.date(e.endDate)}${e.term ? ` · ${e.term}` : ''}`}
                right={<Badge tone={e.status === 'completed' ? 'success' : e.status === 'ongoing' ? 'info' : 'neutral'}>{e.status.toUpperCase()}</Badge>}
                onPress={() => nav.navigate('ExamDetail', { id: e.id })}
              />
            ))}
          </Card>
        )}
    </ScrollScreen>
  );
}

export function ExamDetailScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'ExamDetail'>>();
  const nav = useNavigation<Nav>();
  const { user, permissions } = useSession();
  const fmt = useFormat();
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const classes = useClasses();
  const detail = useExam(route.params.id, classId);
  const canEnter = can(permissions, PERM.resultsEnter);

  return (
    <ScrollScreen refreshing={detail.isFetching} onRefresh={() => void detail.refetch()}>
      {detail.isLoading ? <LoadingView text="Loading date-sheet…" />
        : detail.isError || !detail.data ? <ErrorView message={friendlyMessage(detail.error)} onRetry={() => void detail.refetch()} />
        : (
          <>
            <Card>
              <Text style={styles.title}>{detail.data.name}</Text>
              <Text style={styles.sub}>{fmt.date(detail.data.startDate)} – {fmt.date(detail.data.endDate)}</Text>
              {user?.role === 'student' && (
                <Btn
                  title="View my result" variant="secondary" style={styles.top}
                  onPress={() => nav.navigate('Results', { examId: detail.data.id })}
                />
              )}
            </Card>
            {user?.role !== 'student' && (
              <View style={styles.chipRow}>
                <Chip label="All classes" selected={!classId} onPress={() => setClassId(undefined)} />
                {(classes.data ?? []).map((c) => (
                  <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => setClassId(classId === c.id ? undefined : c.id)} />
                ))}
              </View>
            )}
            <SectionTitle>Date-sheet</SectionTitle>
            <Card>
              {detail.data.schedules.length === 0 && <Text style={styles.sub}>No papers scheduled.</Text>}
              {detail.data.schedules.map((s) => (
                <ListRow
                  key={s.id}
                  title={`${s.subjectName} · ${s.className}`}
                  sub={`${fmt.date(s.date)} · ${fmt.time(s.startTime)} – ${fmt.time(s.endTime)} · Max ${s.maxMarks}`}
                  right={canEnter
                    ? <Badge tone="info">ENTER MARKS</Badge>
                    : <Badge tone="neutral">{s.room || '—'}</Badge>}
                  onPress={canEnter
                    ? () => nav.navigate('EnterMarks', { scheduleId: s.id, examId: s.examId, classId: s.classId, subjectId: s.subjectId })
                    : undefined}
                />
              ))}
            </Card>
          </>
        )}
    </ScrollScreen>
  );
}

/* --------------------------------- results --------------------------------- */

function gradeTone(grade: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  if (grade.startsWith('A')) return 'success';
  if (grade.startsWith('B')) return 'info';
  if (grade === 'C' || grade === 'D') return 'warning';
  if (grade === 'F') return 'danger';
  return 'neutral';
}

export function ResultsScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'Results'>>();
  const { user } = useSession();
  const fmt = useFormat();
  const isStudent = user?.role === 'student';
  const exams = useExams();
  const classes = useClasses();
  const [examId, setExamId] = useState(route.params.examId ?? '');
  const [classId, setClassId] = useState(route.params.classId ?? '');
  const [expanded, setExpanded] = useState<string | null>(null);
  const results = useResults(examId, isStudent ? undefined : classId || undefined, isStudent ? user?.linkedStudentId ?? undefined : undefined, {
    enabled: !!examId && (isStudent || !!classId),
  });

  return (
    <ScrollScreen refreshing={results.isFetching} onRefresh={() => void results.refetch()}>
      <Text style={styles.label}>Exam</Text>
      <View style={styles.chipRow}>
        {(exams.data ?? []).map((e) => (
          <Chip key={e.id} label={e.name} selected={examId === e.id} onPress={() => setExamId(e.id)} />
        ))}
      </View>
      {!isStudent && (
        <>
          <Text style={styles.label}>Class</Text>
          <View style={styles.chipRow}>
            {(classes.data ?? []).map((c) => (
              <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => setClassId(c.id)} />
            ))}
          </View>
        </>
      )}
      {!examId || (!isStudent && !classId) ? <EmptyState icon="stats-chart" title="Select an exam" hint={isStudent ? 'Pick an exam to see your report.' : 'Pick an exam and class.'} />
        : results.isLoading ? <LoadingView text="Computing results…" />
        : results.isError ? <ErrorView message={friendlyMessage(results.error)} onRetry={() => void results.refetch()} />
        : !results.data ? <EmptyState icon="stats-chart" title="No results" hint="Results will appear here once published." />
        : (
          <>
            <Card>
              <Text style={styles.sub}>
                Average {results.data.stats.average}% · Highest {results.data.stats.highest}% · Pass {results.data.stats.passPct}%
              </Text>
            </Card>
            <Card>
              {results.data.rows.map((r) => (
                <View key={r.studentId}>
                  <ListRow
                    title={`#${r.rank} ${r.studentName}`}
                    sub={`${r.total}/${r.maxTotal} · ${r.percent}%`}
                    right={<Badge tone={gradeTone(r.grade)}>{r.grade}</Badge>}
                    onPress={() => setExpanded(expanded === r.studentId ? null : r.studentId)}
                  />
                  {expanded === r.studentId && (
                    <View style={styles.subjects}>
                      {r.subjects.map((s) => (
                        <View key={s.subjectId} style={styles.subjectRow}>
                          <Text style={styles.subjectName}>{s.subjectName}</Text>
                          <Text style={styles.subjectMarks}>{s.absent ? 'Absent' : `${s.obtained}/${s.max}`}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </Card>
            <Text style={styles.count}>{fmt.date(new Date().toISOString().slice(0, 10))} · computed live on the server</Text>
          </>
        )}
    </ScrollScreen>
  );
}

/* -------------------------------- enter marks ------------------------------- */

export function EnterMarksScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'EnterMarks'>>();
  const nav = useNavigation<Nav>();
  const { scheduleId, examId, classId, subjectId } = route.params;
  const pupils = useStudents({ classId });
  const results = useResults(examId, classId);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [absent, setAbsent] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const save = useSaveMarksBulk({
    onSuccess: (d) => {
      Alert.alert('Saved', `${d.saved} mark(s) confirmed by the server.`, [{ text: 'OK', onPress: () => nav.goBack() }]);
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  const existing = new Map(
    (results.data?.rows ?? []).flatMap((r) => r.subjects
      .filter((s) => s.subjectId === subjectId)
      .map((s) => [r.studentId, s] as const)),
  );

  return (
    <ScrollScreen>
      {pupils.isLoading ? <LoadingView text="Loading class…" />
        : pupils.isError ? <ErrorView message={friendlyMessage(pupils.error)} onRetry={() => void pupils.refetch()} />
        : (
          <Card>
            {(pupils.data ?? []).map((p) => {
              const prior = existing.get(p.id);
              return (
                <View key={p.id} style={styles.markRow}>
                  <View style={styles.markName}>
                    <Text style={styles.markTitle}>{p.firstName} {p.lastName}</Text>
                    <Text style={styles.sub}>Roll {p.rollNo || '—'}{prior ? ` · was ${prior.absent ? 'absent' : prior.obtained}/${prior.max}` : ''}</Text>
                  </View>
                  <Chip label={absent[p.id] ? 'Absent' : 'Present'} selected={!!absent[p.id]} onPress={() => setAbsent((a) => ({ ...a, [p.id]: !a[p.id] }))} />
                  <View style={styles.markInput}>
                    <Field
                      label="" value={marks[p.id] ?? ''} onChangeText={(v) => setMarks((m) => ({ ...m, [p.id]: v }))}
                      keyboardType="decimal-pad" placeholder="0" editable={!absent[p.id]}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        title="Save marks"
        loading={save.isPending}
        onPress={() => {
          const rows = (pupils.data ?? []).map((p) => ({
            studentId: p.id,
            obtainedMarks: absent[p.id] ? 0 : Number(marks[p.id] ?? existing.get(p.id)?.obtained ?? 0),
            isAbsent: !!absent[p.id],
          }));
          if (rows.some((r) => !Number.isFinite(r.obtainedMarks) || r.obtainedMarks < 0)) {
            setError('All marks must be numbers 0 or above.');
            return;
          }
          setError('');
          save.mutate({ scheduleId, rows });
        }}
      />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  top: { marginTop: 10 },
  subjects: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8, gap: 6 },
  subjectRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subjectName: { fontSize: 13, color: '#334155' },
  subjectMarks: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  count: { fontSize: 12, color: '#94a3b8' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  markName: { flex: 1 },
  markTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  markInput: { width: 76 },
  error: { fontSize: 13, color: '#b91c1c' },
});
