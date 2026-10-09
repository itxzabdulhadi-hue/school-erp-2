# iOS — build, sign, distribute, submit

Builds run on **EAS Build** (macOS/Xcode not required). For local archive
exports, any Mac with Xcode + `npx expo prebuild` works — steps in §6.

Prerequisites: Node 22, `npm i -g eas-cli`, Expo account, `eas init` once,
and an **Apple Developer Program** membership ($99/yr) for devices/TestFlight.

## 1. Configure

```bash
cd mobile
cp .env.example .env   # local dev only
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://api.your-school.edu
eas secret:create --scope project --name EXPO_PUBLIC_SCHOOL_SLUG --value sunrise
```

Identity (env-driven in `app.config.ts`):

| Key | Meaning | Rule |
|---|---|---|
| `EXPO_PUBLIC_BUNDLE_ID` | `ios.bundleIdentifier` | Reverse-DNS, unique per App Store listing, immutable after first upload |
| `EXPO_PUBLIC_IOS_BUILD_NUMBER` | `ios.buildNumber` | Auto-incremented by EAS (`appVersionSource: remote`) |
| `EXPO_PUBLIC_APP_NAME` | Display name | ≤ 30 chars recommended |

## 2. Signing, certificates, provisioning (via EAS)

On the first iOS build EAS interactively creates everything in your Apple
account (or reuse existing):

- **Distribution certificate** (`.p12`, stored encrypted by EAS) — signs the IPA.
- **Provisioning profiles**: *App Store* profile for `production`, *Ad Hoc* /
  *Development* profiles for `preview` builds on registered devices.
- **Push key** (`.p8`, Apple Push Notification service) — required for
  `expo-notifications` in production; EAS prompts to create/attach it.

Inspect/rotate any time: `eas credentials`. Team roles: builds need an Apple
ID with **Admin** (certificates) or **App Manager** (existing certs) rights.

`preview` iOS builds install on registered UDIDs only
(`eas device:create` to register a device, then rebuild).

## 3. Builds

```bash
eas build --platform ios --profile preview       # QA install (registered devices)
eas build --platform ios --profile production    # App Store IPA
```

## 4. TestFlight + App Store submission

```bash
eas submit --platform ios --profile production   # uploads the latest IPA
```

Checklist:

- [ ] Clean tree, tag `vX.Y.Z`; release notes drafted.
- [ ] App Store Connect record: bundle id matches, screenshots (6.7" + 6.5" +
      iPad), privacy policy URL, support URL, age rating questionnaire.
- [ ] **Privacy manifest**: the app uses Photo Library (attachments) with
      `NSPhotoLibraryUsageDescription` set in `app.config.ts`; no tracking
      (no ATT prompt needed). Push uses a device token only after opt-in.
- [ ] Data collection answers: account email, school records the user views,
      user-attached files — all transmitted over HTTPS to the school's API.
- [ ] TestFlight external group first (attach a demo login:
      `student@sunrise.edu` / seed password on the staging API).
- [ ] Submit for review → release manually or automatically.

Common rejections to pre-empt: placeholder/demo content (seed realistic data),
missing demo account for reviewers, broken privacy-policy link.

## 5. OTA updates

Same as Android: `eas update --channel production` for JS-only changes.
Native changes (permissions, icons, splash, SDK, bundle id) need a new IPA.

## 6. Local Xcode archive (optional, Mac only)

```bash
cd mobile
npx expo prebuild --platform ios   # generates ios/
open ios/*.xcworkspace             # sign with your team, Product → Archive
```

Use this path only when a school policy forbids cloud builds; otherwise EAS
stays the single supported release pipeline.
