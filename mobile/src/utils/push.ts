import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ApiClient } from '../api/client';
import { appConfig } from '../config';

/** Foreground presentation for incoming pushes. Safe no-op where unsupported. */
export function setupNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      // Key names differ across SDK versions; the native side reads what it knows.
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }) as never,
    });
  } catch {
    // Notifications unavailable (e.g. Expo Go without a dev build) — non-fatal.
  }
}

/**
 * Register this device for push. Returns the Expo push token, or null when
 * push is unavailable (simulator, denied permission, missing EAS project id).
 * Never throws — callers treat it as best-effort.
 */
export async function registerForPush(client: ApiClient): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const current = await Notifications.getPermissionsAsync();
    const status = current.status === 'granted'
      ? 'granted'
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
      || appConfig.easProjectId;
    if (!projectId || projectId.startsWith('00000000')) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await client.post('/api/v1/devices', { pushToken: token, platform: Platform.OS });
    return token;
  } catch {
    return null;
  }
}
