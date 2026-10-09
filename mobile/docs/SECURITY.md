# Mobile security & reliability

## Token & session handling

- Access (15 min) + rotating refresh tokens (30 days, single-use, hashed at rest).
- Stored in **SecureStore** (iOS Keychain / Android Keystore) — never
  AsyncStorage, never logs, never crash reports.
- 401 → exactly one single-flight refresh + one retry, else forced sign-out.
  No refresh loops, no silent infinite retries.
- Logout revokes the server refresh token and wipes local tokens.

## Transport & secrets

- HTTPS only in production. `EXPO_PUBLIC_API_URL` must be `https://` for any
  `preview`/`production` build; plain-HTTP hosts are rejected by policy
  (add ATS/NSC exceptions only for local dev, never in release configs).
- No passwords stored (login password lives in component state, cleared on
  unmount). No API secrets, DB credentials, or private keys in the bundle —
  `EXPO_PUBLIC_*` values are public by design (URL + school slug only).
- Certificate pinning is a roadmap item for high-assurance deployments
  (document the pins in the school's runbook before enabling).

## Data handling on device

- React Query cache is **memory-only** (no persistence plugin): quitting the
  app drops student/finance data. Downloads go to app-private storage and are
  shared only through the OS share sheet at the user's explicit tap.
- Screens render loading / error / empty states; mutations show success **only**
  after the server confirms (no optimistic writes anywhere).
- Permission UI gating (`can()`) is cosmetic — the server enforces every call
  (see `server/src/auth/permissions.ts` + `mobile/docs/API.md`).

## Failure matrix (implemented)

| Failure | Behavior |
|---|---|
| Expired session | Refresh once → retry; else sign-out with “session expired” |
| 403 forbidden | “You do not have permission” (no retry) |
| 422 validation | Server message shown; form keeps user input |
| Network down | Offline banner + “No connection” errors with retry buttons |
| 5xx / timeout | “Try again later”; reads retry 2×, writes never auto-retry |
| Revoked/disabled account | Next call 401s → signed out |

## Release checklist

- [ ] `EXPO_PUBLIC_API_URL` is HTTPS; staging URL not left in production secrets.
- [ ] Real JWT secrets + Postgres credentials server-side (see `server/.env.example`).
- [ ] Demo passwords changed/disabled on any public API; seed accounts removed.
- [ ] Play Data Safety + App Store privacy answers match this document.
- [ ] `npm run lint`-clean, `npm test` green, `docs/TESTING.md` sign-off.
