import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useCollectPayment, useInvoice, useInvoices, useReceipt } from '../api/query';
import { useSession } from '../auth/session';
import { can, PERM } from '../auth/permissions';
import { useFormat, useTheme } from '../branding/theme';
import {
  Badge, Btn, Card, Chip, EmptyState, ErrorView, Field,
  ListRow, LoadingView, ScrollScreen, SectionTitle, StatCard,
} from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'info';
  if (status === 'overdue') return 'danger';
  if (status === 'cancelled') return 'neutral';
  return 'warning';
}

function InvoiceList({ studentId }: { studentId?: string }): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const fmt = useFormat();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const list = useInvoices({ studentId, status });

  return (
    <View style={styles.gap}>
      <View style={styles.chipRow}>
        {['', 'unpaid', 'partial', 'overdue', 'paid'].map((s) => (
          <Chip key={s || 'all'} label={s || 'All'} selected={(status ?? '') === s} onPress={() => setStatus(s || undefined)} />
        ))}
      </View>
      {list.isLoading ? <LoadingView />
        : list.isError ? <ErrorView message={friendlyMessage(list.error)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="cash" title="No invoices" hint="Nothing matches this filter." />
        : (
          <Card>
            {(list.data ?? []).map((i) => (
              <ListRow
                key={i.id}
                title={`${i.invoiceNo} · ${i.studentName}`}
                sub={`Due ${fmt.date(i.dueDate)} · Balance ${fmt.money(i.balance)}`}
                right={<Badge tone={statusTone(i.status)}>{i.status.toUpperCase()}</Badge>}
                onPress={() => nav.navigate('Invoice', { id: i.id })}
              />
            ))}
          </Card>
        )}
    </View>
  );
}

/* ------------------------------ admin console ------------------------------ */

export function FinanceScreen(): React.JSX.Element {
  const fmt = useFormat();
  const all = useInvoices();
  const outstanding = (all.data ?? []).filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const overdue = outstanding.filter((i) => i.status === 'overdue').length;

  return (
    <ScrollScreen refreshing={all.isFetching} onRefresh={() => void all.refetch()}>
      <View style={styles.stats}>
        <StatCard
          label="Outstanding" icon="cash"
          value={fmt.money(outstanding.reduce((t, i) => t + Number(i.balance), 0))}
          sub={`${outstanding.length} open invoice(s)`}
        />
        <StatCard label="Overdue" icon="alert-circle" value={String(overdue)} />
      </View>
      <SectionTitle>Invoices</SectionTitle>
      <InvoiceList />
    </ScrollScreen>
  );
}

/* ------------------------------- student fees ------------------------------ */

export function FeesScreen(): React.JSX.Element {
  const { user } = useSession();
  const fmt = useFormat();
  const list = useInvoices(user?.linkedStudentId ? { studentId: user.linkedStudentId } : undefined);
  const due = (list.data ?? []).filter((i) => i.status !== 'paid' && i.status !== 'cancelled');

  return (
    <ScrollScreen refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
      <Card>
        <Text style={styles.label}>Total outstanding</Text>
        <Text style={styles.big}>{fmt.money(due.reduce((t, i) => t + Number(i.balance), 0))}</Text>
        <Text style={styles.sub}>Pay at the school office — online payment is coming soon.</Text>
      </Card>
      <SectionTitle>My invoices</SectionTitle>
      <InvoiceList studentId={user?.linkedStudentId ?? undefined} />
    </ScrollScreen>
  );
}

/* ------------------------------- invoice ----------------------------------- */

export function InvoiceDetailScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'Invoice'>>();
  const nav = useNavigation<Nav>();
  const { permissions } = useSession();
  const fmt = useFormat();
  const inv = useInvoice(route.params.id);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const collect = useCollectPayment({
    onSuccess: (d) => {
      Alert.alert('Payment recorded', `Receipt ${d.receiptNo} confirmed by the server.`, [
        { text: 'View receipt', onPress: () => nav.navigate('Receipt', { paymentId: d.id }) },
        { text: 'Done', style: 'cancel' },
      ]);
    },
    onError: (err) => setError(friendlyMessage(err)),
  });

  if (inv.isLoading) return <LoadingView text="Loading invoice…" />;
  if (inv.isError || !inv.data) {
    return (
      <ScrollScreen>
        <ErrorView message={friendlyMessage(inv.error)} onRetry={() => void inv.refetch()} />
      </ScrollScreen>
    );
  }
  const i = inv.data;
  const canCollect = can(permissions, PERM.feesCollect) && i.status !== 'paid' && i.status !== 'cancelled';

  return (
    <ScrollScreen refreshing={inv.isFetching} onRefresh={() => void inv.refetch()}>
      <Card>
        <View style={styles.headRow}>
          <View>
            <Text style={styles.title}>{i.invoiceNo}</Text>
            <Text style={styles.sub}>{i.studentName} · {i.admissionNo}</Text>
          </View>
          <Badge tone={statusTone(i.status)}>{i.status.toUpperCase()}</Badge>
        </View>
        <Text style={styles.sub}>Issued {fmt.date(i.issueDate)} · Due {fmt.date(i.dueDate)}</Text>
        {(i.lines ?? []).map((l) => (
          <View key={l.id} style={styles.line}>
            <Text style={styles.lineLabel}>{l.label} × {l.qty}</Text>
            <Text style={styles.lineValue}>{fmt.money(Number(l.qty) * Number(l.amount))}</Text>
          </View>
        ))}
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Total</Text>
          <Text style={styles.total}>{fmt.money(i.total)}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Paid</Text>
          <Text style={styles.lineValue}>{fmt.money(i.paid)}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Balance</Text>
          <Text style={styles.balance}>{fmt.money(i.balance)}</Text>
        </View>
      </Card>

      {(i.payments ?? []).length > 0 && (
        <>
          <SectionTitle>Payments</SectionTitle>
          <Card>
            {(i.payments ?? []).map((p) => (
              <ListRow
                key={p.id}
                title={`${p.receiptNo} · ${fmt.money(p.amount)}`}
                sub={`${fmt.date(p.paymentDate)} · ${p.method}`}
                onPress={() => nav.navigate('Receipt', { paymentId: p.id })}
              />
            ))}
          </Card>
        </>
      )}

      {canCollect && (
        <>
          <SectionTitle>Collect payment</SectionTitle>
          <Card>
            <Field label={`Amount (balance ${fmt.money(i.balance)})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={String(i.balance)} />
            <Text style={styles.label}>Method</Text>
            <View style={styles.chipRow}>
              {['cash', 'bank', 'card', 'online', 'cheque'].map((m) => (
                <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />
              ))}
            </View>
            <Field label="Reference (optional)" value={reference} onChangeText={setReference} placeholder="Transaction / cheque no" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn
              title="Confirm payment"
              loading={collect.isPending}
              onPress={() => {
                const v = Number(amount || i.balance);
                if (!Number.isFinite(v) || v <= 0) { setError('Enter a valid amount.'); return; }
                if (v - Number(i.balance) > 0.005) { setError('Amount exceeds the outstanding balance.'); return; }
                setError('');
                collect.mutate({ invoiceId: i.id, amount: v, method, reference });
              }}
            />
          </Card>
        </>
      )}
    </ScrollScreen>
  );
}

/* -------------------------------- receipt ---------------------------------- */

export function ReceiptScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'Receipt'>>();
  const fmt = useFormat();
  const { brand } = useTheme();
  const receipt = useReceipt(route.params.paymentId);

  if (receipt.isLoading) return <LoadingView text="Loading receipt…" />;
  if (receipt.isError || !receipt.data) {
    return (
      <ScrollScreen>
        <ErrorView message={friendlyMessage(receipt.error)} onRetry={() => void receipt.refetch()} />
      </ScrollScreen>
    );
  }
  const { payment: p, invoice: i, student: s, school } = receipt.data;

  return (
    <ScrollScreen>
      <Card style={styles.receipt}>
        <Text style={[styles.school, { color: brand.primary }]}>{school.name}</Text>
        {school.tagline ? <Text style={styles.sub}>{school.tagline}</Text> : null}
        <Text style={styles.receiptNo}>{p.receiptNo}</Text>
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Student</Text>
          <Text style={styles.lineValue}>{s.firstName} {s.lastName}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Invoice</Text>
          <Text style={styles.lineValue}>{i.invoiceNo}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Date</Text>
          <Text style={styles.lineValue}>{fmt.date(p.paymentDate)}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Method</Text>
          <Text style={styles.lineValue}>{p.method}{p.reference ? ` · ${p.reference}` : ''}</Text>
        </View>
        {p.receivedBy ? (
          <View style={styles.line}>
            <Text style={styles.lineLabel}>Received by</Text>
            <Text style={styles.lineValue}>{p.receivedBy}</Text>
          </View>
        ) : null}
        <Text style={styles.amount}>{fmt.money(p.amount)}</Text>
        <Badge tone="success">PAYMENT CONFIRMED</Badge>
      </Card>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  stats: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  big: { fontSize: 30, fontWeight: '800', color: '#0f172a', marginVertical: 4 },
  title: { fontSize: 19, fontWeight: '800', color: '#0f172a' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 6 },
  lineLabel: { fontSize: 14, color: '#64748b' },
  lineValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  total: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  balance: { fontSize: 16, fontWeight: '800', color: '#b91c1c' },
  error: { fontSize: 13, color: '#b91c1c' },
  receipt: { alignItems: 'center', gap: 4 },
  school: { fontSize: 20, fontWeight: '800' },
  receiptNo: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginVertical: 6 },
  amount: { fontSize: 32, fontWeight: '800', color: '#0f172a', marginVertical: 8 },
});
