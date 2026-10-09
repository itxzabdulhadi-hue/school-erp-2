import NetInfo from '@react-native-community/netinfo';
import { StyleSheet, Text, View } from 'react-native';

/** Persistent banner whenever the device loses connectivity. */
export function OfflineBanner(): React.JSX.Element | null {
  const net = NetInfo.useNetInfo();
  if (net.isConnected !== false) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>You are offline — changes will be available when you reconnect.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#b91c1c', paddingVertical: 8, paddingHorizontal: 16 },
  text: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
