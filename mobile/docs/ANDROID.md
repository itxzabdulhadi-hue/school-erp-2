# Android — build, sign, distribute, update

All native builds run on **EAS Build** (no local Android SDK required).
Prerequisites: Node 22, `npm i -g eas-cli`, an Expo account, `eas init` once
(links the EAS project id used by `app.config.ts`).

## 1. Configure

```bash
cd mobile
cp .env.example .env   # local dev only; production values come from EAS
```

Set production env as EAS secrets (never commit them):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://api.your-school.edu
eas secret:create --scope project --name EXPO_PUBLIC_SCHOOL_SLUG --value sunrise
```

Per-school variants: override `EXPO_PUBLIC_APP_NAME`, `EXPO_PUBLIC_APP_SLUG`,
`EXPO_PUBLIC_BUNDLE_ID` (e.g. `com.yourschool.erp`) per build — see
`docs/BRANDING.md`. `android.package` **must be unique per Play listing** and
can never change after the first upload.

## 2. Builds (`eas.json` profiles)

| Profile | Output | Use |
|---|---|---|
| `development` | dev-client APK | Daily dev on device (`npx expo start --dev-client`) |
| `preview` | **APK** (internal) | QA + direct download distribution |
| `production` | **AAB** (store) | Google Play submission |
| `production-apk` | signed release APK | Direct download of the exact store binary |

```bash
eas build --platform android --profile preview        # installable APK link
eas build --platform android --profile production     # Play-ready AAB
```

Versioning: `cli.appVersionSource: remote` + `autoIncrement` bump
`versionCode` automatically from Play. `version` in `app.config.ts` is the
user-visible name — bump it (`1.0.0` → `1.1.0`) for each store release.

## 3. Signing

EAS manages the upload keystore automatically on first build
(`eas credentials` to inspect/rotate). Recommended for Play:

1. Let Play App Signing hold the final signing key (default for new apps).
2. Keep the EAS-managed **upload key**; back it up via
   `eas credentials` → download keystore, stored in the school's vault.
3. Never commit `*.keystore` / `*.jks` — they are gitignored by policy.

Direct-download APKs from `preview`/`production-apk` are signed with the same
key, so users can upgrade from APK → Play build without reinstalling.

## 4. Direct-download installation (outside Play)

1. Download the APK link from the EAS build page (or host it on the school site).
2. On the device: allow *Install unknown apps* for the browser when prompted.
3. Open the APK → Install. Updates = install the newer APK (same package +
   same key upgrades in place, data preserved).

## 5. Google Play submission checklist

- [ ] `production` AAB built from a clean tree (`git status` clean, tag `vX.Y.Z`).
- [ ] Play Console: app created, package name matches, content rating + data safety
      forms completed (contacts nothing; uploads only user-attached school files).
- [ ] Privacy policy URL live (required) — reuse the school website page.
- [ ] Internal testing track first → promote to production after QA sign-off.
- [ ] `eas submit --platform android --profile production` (configure
      `submit.production.serviceAccountKeyPath` with a Play service-account JSON).

## 6. Updates without a store release

JavaScript/theme/config changes ship over the air with EAS Update
(`runtimeVersion.policy: appVersion` — updates only apply to compatible builds):

```bash
eas update --channel production --message "Fee receipt fixes"
```

Native changes (permissions, icons, splash, SDK upgrades, bundle id) always
need a new AAB. Matrix: `docs/BRANDING.md`.
