import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../branding/theme';

export function SplashScreen(): React.JSX.Element {
  const { brand } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: brand.primary }]}>
      <View style={styles.mark}>
        <Text style={[styles.markText, { color: brand.primary }]}>{brand.name.charAt(0) || 'S'}</Text>
      </View>
      <Text style={styles.name}>{brand.name}</Text>
      {brand.tagline ? <Text style={styles.tag}>{brand.tagline}</Text> : null}
      <ActivityIndicator color="#fff" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  mark: {
    width: 84, height: 84, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  markText: { fontSize: 44, fontWeight: '800' },
  name: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  tag: { fontSize: 14, color: '#e2e8f0', marginTop: 4, textAlign: 'center' },
  spinner: { marginTop: 28 },
});
