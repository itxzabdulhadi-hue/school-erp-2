import { useTheme } from '../branding/theme';
import {
  ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, type TextInputProps, View,
} from 'react-native';
import { AppIcon, type IconName } from './AppIcon';

/* --------------------------------- layout ---------------------------------- */

export function Screen({ children, padded = true, style }: {
  children: React.ReactNode; padded?: boolean; style?: object;
}): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.screen, padded && styles.padded, style]}>
      {children}
    </SafeAreaView>
  );
}

export function ScrollScreen({ children, refreshing, onRefresh, padded = true }: {
  children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void; padded?: boolean;
}): React.JSX.Element {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollInner, padded && styles.padded]}
        refreshControl={refreshing !== undefined && onRefresh
          ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: {
  children: React.ReactNode; style?: object; onPress?: () => void;
}): React.JSX.Element {
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {inner}
    </Pressable>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: object }): React.JSX.Element {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

/* --------------------------------- inputs ---------------------------------- */

export function Btn({ title, onPress, variant = 'primary', loading, disabled, style, icon }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean; disabled?: boolean; style?: object; icon?: IconName;
}): React.JSX.Element {
  const { brand } = useTheme();
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && { backgroundColor: brand.primary },
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        variant === 'ghost' && styles.btnGhost,
        (pressed || off) && styles.btnDim,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : brand.primary} />
        : (
          <View style={styles.btnInner}>
            {icon && (
              <AppIcon
                name={icon}
                size={18}
                color={variant === 'primary' ? '#fff' : variant === 'danger' ? '#fff' : variant === 'ghost' ? brand.primary : '#0f172a'}
              />
            )}
            <Text style={[
              styles.btnText,
              variant === 'primary' && styles.btnTextLight,
              variant === 'danger' && styles.btnTextLight,
              variant === 'ghost' && { color: brand.primary },
            ]}
            >
              {title}
            </Text>
          </View>
        )}
    </Pressable>
  );
}

export function Field({ label, error, hint, ...props }: {
  label: string; error?: string; hint?: string;
} & TextInputProps): React.JSX.Element {
  const { brand } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.inputMulti, error && styles.inputError]}
        placeholderTextColor="#94a3b8"
        selectionColor={brand.primary}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }): React.JSX.Element {
  const { brand } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && { backgroundColor: brand.primary, borderColor: brand.primary }]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/* --------------------------------- display --------------------------------- */

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: '#dcfce7', fg: '#15803d' },
  warning: { bg: '#fef3c7', fg: '#b45309' },
  danger: { bg: '#fee2e2', fg: '#b91c1c' },
  info: { bg: '#e0f2fe', fg: '#0369a1' },
  neutral: { bg: '#f1f5f9', fg: '#475569' },
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }): React.JSX.Element {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }): React.JSX.Element {
  const { brand } = useTheme();
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: brand.primary }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

export function StatCard({ label, value, sub, onPress, icon }: {
  label: string; value: string; sub?: string; onPress?: () => void; icon?: IconName;
}): React.JSX.Element {
  const { brand } = useTheme();
  return (
    <Card onPress={onPress} style={styles.statCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.statLabel}>{label}</Text>
        {icon && <AppIcon name={icon} size={18} color={brand.primary} />}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </Card>
  );
}

/* ------------------------------ state blocks-------------------------------- */

export function LoadingView({ text }: { text?: string }): React.JSX.Element {
  const { brand } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={brand.primary} />
      {text ? <Text style={styles.muted}>{text}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <View style={styles.center}>
      <AppIcon name="alert-circle" size={40} color="#b91c1c" />
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.mutedCenter}>{message}</Text>
      {onRetry && <Btn title="Try again" onPress={onRetry} variant="secondary" icon="refresh" style={styles.retryBtn} />}
    </View>
  );
}

export function EmptyState({ icon = 'information-circle', title, hint, action }: {
  icon?: IconName; title: string; hint?: string; action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIconWrap}>
        <AppIcon name={icon} size={30} color="#64748b" />
      </View>
      <Text style={styles.errorTitle}>{title}</Text>
      {hint ? <Text style={styles.mutedCenter}>{hint}</Text> : null}
      {action}
    </View>
  );
}

export function ListRow({ title, sub, right, onPress, onLongPress, left }: {
  title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; onLongPress?: () => void; left?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={styles.listRow}>
        {left}
        <View style={styles.listRowBody}>
          <Text style={styles.listRowTitle} numberOfLines={1}>{title}</Text>
          {sub ? <Text style={styles.listRowSub} numberOfLines={2}>{sub}</Text> : null}
        </View>
        {right ?? (onPress ? <AppIcon name="chevron-forward" size={20} color="#94a3b8" /> : null)}
      </View>
    </Pressable>
  );
}

/* ---------------------------------- styles ---------------------------------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  padded: { padding: 16 },
  scrollInner: { paddingBottom: 24, gap: 12 },
  pressed: { opacity: 0.7 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnSecondary: { backgroundColor: '#e2e8f0' },
  btnDanger: { backgroundColor: '#b91c1c' },
  btnGhost: { backgroundColor: 'transparent' },
  btnDim: { opacity: 0.65 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  btnTextLight: { color: '#fff' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: '#0f172a',
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  inputError: { borderColor: '#b91c1c' },
  errorText: { fontSize: 12, color: '#b91c1c' },
  hintText: { fontSize: 12, color: '#64748b' },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#fff' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipTextSelected: { color: '#fff' },
  badge: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  statCard: { flex: 1, minWidth: '46%', gap: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  statSub: { fontSize: 12, color: '#64748b' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  muted: { fontSize: 14, color: '#64748b' },
  mutedCenter: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  errorTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  retryBtn: { marginTop: 8 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listRowBody: { flex: 1 },
  listRowTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  listRowSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
});
