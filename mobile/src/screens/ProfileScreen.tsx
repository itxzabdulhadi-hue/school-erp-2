import * as Application from 'expo-application';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage } from '../api/client';
import { useSession } from '../auth/session';
import { useTheme } from '../branding/theme';
import { Avatar, Badge, Btn, Card, Divider, ScrollScreen, SectionTitle } from '../components/ui';
import { appConfig } from '../config';

export function ProfileScreen(): React.JSX.Element {
  const { user, logout, reloadMe } = useSession();
  const { brand } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refresh = async (): Promise<void> => {
    setRefreshing(true);
    setError('');
    try {
      await reloadMe();
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const confirmLogout = (): void => {
    Alert.alert('Sign out?', 'You will need your email and password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Card>
        <View style={styles.userRow}>
          <Avatar name={user?.name ?? '?'} size={56} />
          <View style={styles.userMeta}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Badge tone="info">{user?.role.toUpperCase()}</Badge>
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <SectionTitle>School</SectionTitle>
      <Card>
        <Text style={styles.name}>{brand.name}</Text>
        {brand.tagline ? <Text style={styles.email}>{brand.tagline}</Text> : null}
        <Divider />
        <Text style={styles.email}>Currency: {brand.currency} ({brand.currencySymbol})</Text>
        <Text style={styles.email}>Dates: {brand.dateFormat}</Text>
      </Card>

      <SectionTitle>App</SectionTitle>
      <Card>
        <Text style={styles.email}>
          Version {Application.nativeApplicationVersion ?? '1.0.0'} ({Application.nativeBuildVersion ?? '1'})
        </Text>
        <Text style={styles.email}>API: {appConfig.apiUrl}</Text>
        <Text style={styles.email}>School: {appConfig.schoolSlug}</Text>
      </Card>

      <Btn title="Sign out" variant="danger" onPress={confirmLogout} icon="log-out" />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  userRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  userMeta: { flex: 1, gap: 4 },
  name: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  email: { fontSize: 14, color: '#64748b' },
  error: { fontSize: 13, color: '#b91c1c', marginTop: 8 },
});
