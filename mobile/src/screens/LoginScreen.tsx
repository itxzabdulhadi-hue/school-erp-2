import { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { friendlyMessage } from '../api/client';
import { useSession } from '../auth/session';
import { useTheme } from '../branding/theme';
import { AppIcon } from '../components/AppIcon';
import { Btn, Field } from '../components/ui';
import { appConfig } from '../config';

const DEMO = [
  { role: 'Admin', email: 'admin@sunrise.edu' },
  { role: 'Teacher', email: 'ayesha.khan@sunrise.edu' },
  { role: 'Student', email: 'student@sunrise.edu' },
  { role: 'Staff', email: 'kamran.ali@sunrise.edu' },
];

export function LoginScreen(): React.JSX.Element {
  const { brand } = useTheme();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (): Promise<void> => {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            {brand.logoUrl ? (
              <Image source={{ uri: brand.logoUrl }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={[styles.mark, { backgroundColor: brand.primary }]}>
                <Text style={styles.markText}>{brand.name.charAt(0) || 'S'}</Text>
              </View>
            )}
            <Text style={styles.name}>{brand.name}</Text>
            {brand.tagline ? <Text style={styles.tag}>{brand.tagline}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Sign in</Text>
            <Field
              label="Email" value={email} onChangeText={(v) => { setEmail(v); setError(''); }}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email"
              placeholder="you@school.edu"
            />
            <View>
              <Field
                label="Password" value={password} onChangeText={(v) => { setPassword(v); setError(''); }}
                secureTextEntry={!showPassword} autoComplete="password"
                placeholder="••••••••" onSubmitEditing={() => void submit()}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={styles.eye}
              >
                <AppIcon name={showPassword ? 'eye' : 'eye'} size={20} color="#64748b" />
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn title="Sign in" onPress={() => void submit()} loading={busy} />
          </View>

          <View style={styles.demo}>
            <Text style={styles.demoTitle}>Demo autofill (seeded dev server)</Text>
            <View style={styles.demoRow}>
              {DEMO.map((d) => (
                <Pressable
                  key={d.role}
                  onPress={() => { setEmail(d.email); setPassword('School@123'); setError(''); }}
                  style={[styles.demoChip, { borderColor: brand.primary }]}
                >
                  <Text style={[styles.demoChipText, { color: brand.primary }]}>{d.role}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.host}>API: {appConfig.apiUrl}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  flex: { flex: 1 },
  inner: { padding: 24, gap: 20, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 6 },
  mark: { width: 76, height: 76, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 40, fontWeight: '800', color: '#fff' },
  logo: { width: 120, height: 76 },
  name: { fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  tag: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 12 },
  title: { fontSize: 19, fontWeight: '800', color: '#0f172a' },
  eye: { position: 'absolute', right: 12, top: 34 },
  error: { fontSize: 13, color: '#b91c1c' },
  demo: { alignItems: 'center', gap: 8 },
  demoTitle: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  demoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  demoChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#fff' },
  demoChipText: { fontSize: 13, fontWeight: '700' },
  host: { fontSize: 11, color: '#94a3b8' },
});
