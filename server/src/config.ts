/** Central environment configuration. No secrets are ever bundled or logged. */

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-please',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-please',
  accessTtlMinutes: num(process.env.ACCESS_TTL_MINUTES, 15),
  refreshTtlDays: num(process.env.REFRESH_TTL_DAYS, 30),
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 15),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  expoPushEnabled: process.env.EXPO_PUSH_ENABLED === 'true',
  demoSeedPassword: process.env.DEMO_SEED_PASSWORD ?? 'School@123',
};

export function assertProductionSecrets(): void {
  if (config.nodeEnv === 'production') {
    for (const [k, v] of Object.entries({
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
    })) {
      if (!v) throw new Error(`Missing required env var ${k} in production`);
    }
    if (config.jwtAccessSecret.length < 32 || config.jwtRefreshSecret.length < 32) {
      throw new Error('JWT secrets must be at least 32 characters in production');
    }
  }
}
