# School ERP — mobile apps (Android + iOS)

Expo + React Native + TypeScript clients of the School ERP API. One codebase
ships white-label Android (APK/AAB) and iOS (IPA) builds per school.

> The apps are **functional API clients** — every screen reads/writes the same
> PostgreSQL-backed ERP the API serves. There is no demo mode and no local
> mock data: without a reachable API the app shows an honest offline state.

## Quick start

```bash
# 1. API (see ../server/README.md)
cd ../server && cp .env.example .env && docker compose up -d
npm install && npm run seed:fresh && npm run dev

# 2. App
cd ../mobile && npm install && cp .env.example .env
# point EXPO_PUBLIC_API_URL at the API (10.0.2.2 for Android emulator, LAN IP for devices)
npx expo start   # press a (Android) / i (iOS) / scan with Expo Go
```

Demo logins (seeded): `admin@sunrise.edu`, `ayesha.khan@sunrise.edu`,
`student@sunrise.edu`, `kamran.ali@sunrise.edu` — password `School@123`.

## Project map

```
mobile/
  app.config.ts          # env-driven white-label native config (name, bundle id, icons…)
  eas.json               # development / preview (APK) / production (AAB/IPA) profiles
  assets/                # icon, adaptive icon, splash (generated: npm run assets)
  scripts/make-assets.js # zero-dep placeholder asset generator
  src/
    config.ts            # runtime env (API URL, school slug, brand overrides)
    api/                 # client.ts (auth/refresh/errors), endpoints.ts, query.tsx (hooks)
    auth/                # session.tsx (SecureStore JWT), permissions.ts (UI gating)
    branding/theme.tsx   # server-driven white-label theme + formatting
    navigation/          # role-based tabs + stack (RootNavigator)
    components/          # UI kit (ui.tsx), AppIcon, OfflineBanner
    screens/             # Splash, Login, 4 dashboards, 20+ module screens
    utils/               # files.ts (pick/download/share), push.ts
  tests/                 # vitest: API client + permission gating
  docs/                  # API, ANDROID, IOS, BRANDING, SECURITY, TESTING
```

## Scripts

| Command | Purpose |
|---|---|
| `npx expo start` | Dev server (Emulator / Expo Go / dev client) |
| `npm test` | Unit tests (API client, permissions) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run assets` | Regenerate placeholder icons/splash |
| `eas build --platform android --profile preview` | Installable QA **APK** |
| `eas build --platform android --profile production` | Play **AAB** |
| `eas build --platform ios --profile production` | Store **IPA** |
| `eas update --channel production` | OTA update (JS-only changes) |

## Docs

- [`docs/API.md`](docs/API.md) — auth flow, error codes, endpoint map, uploads
- [`docs/ANDROID.md`](docs/ANDROID.md) — APK/AAB builds, signing, Play submission
- [`docs/IOS.md`](docs/IOS.md) — certs/profiles, TestFlight, App Store review
- [`docs/BRANDING.md`](docs/BRANDING.md) — server vs build-time branding matrix
- [`docs/SECURITY.md`](docs/SECURITY.md) — tokens, storage, failure handling
- [`docs/TESTING.md`](docs/TESTING.md) — auth/permission/nav/file/device matrices
- [`../server/openapi.yaml`](../server/openapi.yaml) — machine-readable contract
