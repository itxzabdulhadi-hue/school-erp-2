import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useClasses, useTimetable } from '../api/query';
import { useSession } from '../auth/session';
import { useFormat } from '../branding/theme';
import { Card, Chip, EmptyState, ErrorView, ListRow, LoadingView, ScrollScreen } from '../components/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TimetableScreen(): React.JSX.Element {
  const { user } = useSession();
  const fmt = useFormat();
  const [day, setDay] = useState<number | undefined>((((new Date().getDay() + 6) % 7) + 1));
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const classes = useClasses();
  const isStudent = user?.role === 'student';
  const list = useTimetable(isStudent ? {} : { classId });

  const slots = (list.data ?? []).filter((s) => !day || Number(s.dayOfWeek) === day);

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
      <View style={styles.chipRow}>
        <Chip label="Week" selected={!day} onPress={() => setDay(undefined)} />
        {DAYS.map((d, i) => (
          <Chip key={d} label={d} selected={day === i + 1} onPress={() => setDay(day === i + 1 ? undefined : i + 1)} />
        ))}
      </View>
      {list.isLoading ? <LoadingView text="Loading timetable…" />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : slots.length === 0 ? <EmptyState icon="calendar" title="No periods" hint="Nothing scheduled for this selection." />
        : (
          <Card>
            {slots.map((s) => (
              <ListRow
                key={s.id}
                title={`${s.subjectName} · ${s.className}${s.sectionName ? `-${s.sectionName}` : ''}`}
                sub={`${DAYS[Number(s.dayOfWeek) - 1] ?? ''} · ${fmt.time(s.startTime)} – ${fmt.time(s.endTime)} · ${s.teacherName || 'TBA'}${s.room ? ` · ${s.room}` : ''}`}
              />
            ))}
            <Text style={styles.count}>{slots.length} period(s)</Text>
          </Card>
        )}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  count: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
});
