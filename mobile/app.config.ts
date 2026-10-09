import type { ConfigContext, ExpoConfig } from 'expo/config';

// White-label native config: every identity value is env-driven so one codebase
// can ship per-school app variants (own name, bundle id, icon set) via EAS.
export default ({ config }: ConfigContext): ExpoConfig => {
  const appName = process.env.EXPO_PUBLIC_APP_NAME || 'School ERP';
  const slug = process.env.EXPO_PUBLIC_APP_SLUG || 'school-erp';
  const bundleId = process.env.EXPO_PUBLIC_BUNDLE_ID || 'com.devzard.schoolerp';
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '00000000-0000-0000-0000-000000000000';
  const primary = process.env.EXPO_PUBLIC_PRIMARY_COLOR || '#1d4ed8';

  return {
    ...config,
    name: appName,
    slug,
    scheme: slug,
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './assets/icon.png',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: bundleId,
      buildNumber: process.env.EXPO_PUBLIC_IOS_BUILD_NUMBER || '1',
      infoPlist: {
        NSPhotoLibraryUsageDescription: 'Attach files and photos to homework and documents.',
      },
    },
    android: {
      package: bundleId,
      versionCode: Number(process.env.EXPO_PUBLIC_ANDROID_VERSION_CODE || 1),
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: primary },
      permissions: ['NOTIFICATIONS'],
    },
    plugins: [
      ['expo-splash-screen', { image: './assets/splash.png', resizeMode: 'cover', backgroundColor: primary }],
      'expo-secure-store',
      'expo-file-system',
      'expo-sharing',
      'expo-document-picker',
      [
        'expo-notifications',
        { icon: './assets/icon.png', color: primary, sounds: [] },
      ],
      'expo-updates',
    ],
    updates: { url: `https://u.expo.dev/${projectId}` },
    runtimeVersion: { policy: 'appVersion' },
    extra: {
      eas: { projectId },
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
      schoolSlug: process.env.EXPO_PUBLIC_SCHOOL_SLUG || 'sunrise',
      schoolName: process.env.EXPO_PUBLIC_SCHOOL_NAME || '',
      primaryColor: process.env.EXPO_PUBLIC_PRIMARY_COLOR || '',
      accentColor: process.env.EXPO_PUBLIC_ACCENT_COLOR || '',
    },
  };
};
