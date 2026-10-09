import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import {
  useAttendanceSheet, useClasses, useMyAttendance, useSaveAttendance, useStudents,
} from '../api/query';
import { useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat } from '../branding/theme';
import {
  Badge, Btn, Card, Chip, EmptyState, ErrorView,
  ListRow, LoadingView, ScrollScreen, SectionTitle,
} from '../components/ui';

const STATUSES = ['present', 'absent', 'late', 'leave', 'excused', 'half-day'] as const;
type Status = (typeof STATUSES)[number];

function tone(s: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  if (s === 'present') return 'success';
  if (s === 'absent') return 'danger';
  if (s === 'late' || s === 'half-day') return 'warning';
  if (s === 'leave' || s === 'excused') return 'info';
  return 'neutral';
}

export function AttendanceScreen(): React.JSX.Element {
  const { user } = useSession();
  if (user?.role === 'student') return <MyAttendance />;
  return <MarkAttendance />;
}

/* ------------------------------ student view ------------------------------- */

function MyAttendance(): React.JSX.Element {
  const fmt = useFormat();
  const data = useMyAttendance();

  return (
    <ScrollScreen refreshing={data.isFetching} onRefresh={() => void data.refetch()}>
      {data.isLoading ? <LoadingView text="Loading attendance…" />
        : data.isError ? <ErrorView message={friendlyMessage(data.error)} onRetry={() => void data.refetch()} />
        : !data.data ? <EmptyState icon="calendar" title="No attendance yet" hint="Records will appear here once marked." />
        : (
          <>
            <Card>
              <Text style={styles.big}>{data.data.summary.pct}%</Text>
              <Text style={styles.sub}>
                {data.data.summary.present} present · {data.data.summary.absent} absent · {data.data.summary.late} late · {data.data.summary.leave} leave
              </Text>
              <Text style={styles.sub}>{data.data.summary.total} marked days (excused/leave excluded from %)</Text>
            </Card>
            <SectionTitle>History</SectionTitle>
            <Card>
              {data.data.records.length === 0 && <Text style={styles.sub}>No records yet.</Text>}
              {data.data.records.map((r, i) => (
                <ListRow
                  key={`${r.date}-${i}`}
                  title={fmt.date(r.date)}
                  sub={r.remarks || undefined}
                  right={<Badge tone={tone(r.status)}>{r.status.toUpperCase()}</Badge>}
                />
              ))}
            </Card>
          </>
        )}
    </ScrollScreen>
  );
}

/* ------------------------------- mark sheet -------------------------------- */

function shift(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function MarkAttendance(): React.JSX.Element {
  const { permissions } = useSession();
  const fmt = useFormat();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loadedFor, setLoadedFor] = useState('');
  const [error, setError] = useState('');
  const classes = useClasses();
  const pupils = useStudents(classId ? { classId } : undefined, { enabled: !!classId });
  const sheet = useAttendanceSheet({ date, classId }, { enabled: !!classId });
  const canMark = can(permissions, PERM.attendanceMark);

  // Prefill from the saved sheet whenever the scope changes.
  const scopeKey = `${date}:${classId ?? ''}`;
  if (classId && sheet.data && loadedFor !== scopeKey) {
    const prefill: Record<string, Status> = {};
    for (const r of sheet.data) {
      if (r.studentId && (STATUSES as readonly string[]).includes(r.status)) prefill[r.studentId] = r.status as Status;
    }
    setMarks(prefill);
    setLoadedFor(scopeKey);
  }

  const save = useSaveAttendance({
    onSuccess: (d) => Alert.alert('Saved', `${d.saved} record(s) confirmed by the server.`),
    onError: (err) => setError(friendlyMessage(err)),
  });

  const cycle = (id: string): void => {
    if (!canMark) return;
    setMarks((m) => {
      const cur = m[id] ?? 'present';
      const next = STATUSES[(STATUSES.indexOf(cur) + 1) % STATUSES.length];
      return { ...m, [id]: next };
    });
  };

  return (
    <ScrollScreen refreshing={sheet.isFetching} onRefresh={() => void sheet.refetch()}>
      <View style={styles.stepper}>
        <Chip label="‹ Prev" selected={false} onPress={() => setDate((d) => shift(d, -1))} />
        <Text style={styles.date}>{fmt.date(date)}</Text>
        <Chip label="Next ›" selected={false} onPress={() => setDate((d) => shift(d, 1))} />
      </View>
      <View style={styles.chipRow}>
        {(classes.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={classId === c.id} onPress={() => { setClassId(classId === c.id ? undefined : c.id); setError(''); }} />
        ))}
      </View>
      {!classId ? <EmptyState icon="clipboard" title="Choose a class" hint="Pick a class to load its day sheet." />
        : pupils.isLoading ? <LoadingView text="Loading class…" />
        : pupils.isError ? <ErrorView message={friendlyMessage(pupils.error)} onRetry={() => void pupils.refetch()} />
        : (
          <>
            {canMark && (
              <Btn title="Mark all present" variant="secondary" onPress={() => {
                const all: Record<string, Status> = {};
                for (const p of pupils.data ?? []) all[p.id] = 'present';
                setMarks(all);
              }}
              />
            )}
            <Card>
              {(pupils.data ?? []).map((p) => {
                const st = marks[p.id] ?? 'present';
                return (
                  <ListRow
                    key={p.id}
                    title={`${p.firstName} ${p.lastName}`}
                    sub={`Roll ${p.rollNo || '—'}`}
                    right={<Badge tone={tone(st)}>{st.toUpperCase()}</Badge>}
                    onPress={canMark ? () => cycle(p.id) : undefined}
                  />
                );
              })}
            </Card>
            {!canMark && <Text style={styles.sub}>View only — your role cannot mark attendance.</Text>}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {canMark && (
              <Btn
                title={`Save ${Object.keys(marks).length || (pupils.data ?? []).length} records`}
                loading={save.isPending}
                onPress={() => {
                  const records = (pupils.data ?? []).map((p) => ({ studentId: p.id, status: marks[p.id] ?? 'present' }));
                  Alert.alert('Save attendance?', `${records.length} record(s) for ${fmt.date(date)}. This replaces any saved sheet for the day.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Save', onPress: () => { setError(''); save.mutate({ date, classId, records }); } },
                  ]);
                }}
              />
            )}
          </>
        )}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 34, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  error: { fontSize: 13, color: '#b91c1c' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
});
