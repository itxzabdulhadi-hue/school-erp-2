import Constants from 'expo-constants';

interface Extra {
  apiUrl?: string;
  schoolSlug?: string;
  schoolName?: string;
  primaryColor?: string;
  accentColor?: string;
  eas?: { projectId?: string };
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Runtime config. EXPO_PUBLIC_* vars are inlined at build time (dev: .env file,
 * EAS: secrets/eas.json env). `extra` from app.config.ts is the fallback so the
 * values also resolve under Expo Go / dev clients consistently.
 */
export const appConfig = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || 'http://localhost:4000').replace(/\/+$/, ''),
  schoolSlug: process.env.EXPO_PUBLIC_SCHOOL_SLUG || extra.schoolSlug || 'sunrise',
  schoolNameOverride: process.env.EXPO_PUBLIC_SCHOOL_NAME || extra.schoolName || '',
  primaryOverride: process.env.EXPO_PUBLIC_PRIMARY_COLOR || extra.primaryColor || '',
  accentOverride: process.env.EXPO_PUBLIC_ACCENT_COLOR || extra.accentColor || '',
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || extra.eas?.projectId || '',
};
