# White-label mobile branding

One codebase ships every school's app. Branding resolves in three layers
(later wins): **server branding → build env overrides → (native identity)**.

## 1. Server-driven branding (no rebuild needed)

The app bootstraps from `GET /school/public?slug=<EXPO_PUBLIC_SCHOOL_SLUG>`
(pre-login) and refines via `GET /school` (post-login). Changing these in the
database re-themes every installed app on next launch / pull-to-refresh:

- School name, tagline, logo URL (login header, receipts)
- Primary + accent colors (headers, tabs, buttons, badges)
- Currency + symbol, date format, timezone, language
- Grading scale (results grades), academic year/term labels

School data isolation is structural: every row carries `school_id`, every
authenticated query is scoped to the caller's school, and JWTs bind
`schoolId` — a token from school A returns nothing from school B.

## 2. Build-time overrides (EAS secrets / env, still no code change)

`app.config.ts` + `src/config.ts` accept per-build overrides for variants:

| Env | Effect |
|---|---|
| `EXPO_PUBLIC_SCHOOL_NAME` | Display name (wins over server) |
| `EXPO_PUBLIC_PRIMARY_COLOR` / `EXPO_PUBLIC_ACCENT_COLOR` | Theme colors |
| `EXPO_PUBLIC_APP_NAME` / `EXPO_PUBLIC_APP_SLUG` | OS-visible app name, URL scheme |
| `EXPO_PUBLIC_BUNDLE_ID` | Android package / iOS bundle id |

Typical per-school release: same commit, different EAS build with that
school's `EXPO_PUBLIC_BUNDLE_ID` + `EXPO_PUBLIC_SCHOOL_SLUG` (+ optionally
swapped `assets/` before building).

## 3. What needs a native rebuild vs an OTA update vs nothing

| Change | Channel |
|---|---|
| Name, colors, logo URL, currency, grading | **Nothing** — server config, live on refresh |
| JS/screens/bug fixes, theme-component tweaks | **OTA**: `eas update --channel production` |
| App display name, bundle id / package | **Rebuild + store release** (new listing if bundle id changes) |
| Icon, splash, adaptive icon, notification icon | **Rebuild** (replace `assets/`, see `assets/README.md`) |
| Permissions, push entitlements, SDK upgrade | **Rebuild + store release** |

## 4. Onboarding a new school (checklist)

1. Server: insert `schools` row (slug, branding, grading scale), seed users.
2. Mobile: EAS build with the school's slug + bundle id (+ custom assets if any).
3. Point `EXPO_PUBLIC_API_URL` at the school's API host (HTTPS).
4. QA against `docs/TESTING.md`, then submit (new Play/App Store listing per
   bundle id, or one listing + in-app school picker — product decision).
5. Day-2 branding tweaks stay in the database; never cut a release for colors.
