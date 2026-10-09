# Testing guide — mobile + API

## 0. Automated checks (run on every change)

```bash
cd server && npm test && npm run typecheck     # API contract + RBAC suite
cd mobile && npm test && npm run typecheck     # client + gating unit tests
```

`server/src/smoke.ts` (`npx tsx src/smoke.ts`) replays the critical flows
without a test runner — useful on machines where vitest workers misbehave.

## 1. Local end-to-end stack

```bash
# Terminal 1 — database + API
cd server && cp .env.example .env && docker compose up -d
npm run seed:fresh        # demo school + 4 demo logins (password: School@123)
npm run dev               # :4000

# Terminal 2 — app
cd mobile && cp .env.example .env
# emulator: EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 (Android) / http://localhost:4000 (iOS)
# device:use your LAN IP, e.g. http://192.168.1.20:4000
npx expo start
```

Demo logins: `admin@sunrise.edu`, `ayesha.khan@sunrise.edu` (teacher),
`student@sunrise.edu`, `kamran.ali@sunrise.edu` (staff).

## 2. Authentication matrix

- [ ] Wrong password → `INVALID_CREDENTIALS`, no hint which field failed.
- [ ] Login → SecureStore holds tokens (verify: kill app, relaunch → still signed in).
- [ ] Revoke server-side (disable user / wipe `refresh_tokens`) → next action signs out.
- [ ] Logout → tokens wiped; relaunch shows login.
- [ ] Throttle: 11 rapid bad logins → 429.

## 3. Permissions matrix (assert UI *and* API)

For each role, verify the tab set matches `RootNavigator.TABS`, then attempt a
forbidden action and confirm a clean 403 (not a crash, not fake success):

| Attempt | As | Expect |
|---|---|---|
| Collect payment | teacher/student | Button hidden; direct API call → 403 |
| Mark attendance | student | Tab hidden; API → 403 |
| Enter marks | student | No entry point; API → 403 |
| Read another pupil | student | Forced to self / 403 |
| Manage users | non-admin | Screen hidden; API → 403 |
| Upload document | student | Hidden; API → 403 |

Curl spot-checks (replace `$T` with a token from login):

```bash
curl -s $API/api/v1/students/OTHER_ID -H "Authorization: Bearer $T"   # 403 for students
curl -s -X POST $API/api/v1/payments -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' -d '{"invoiceId":"x","amount":1}' # 403 for teachers
```

## 4. Navigation per role

- [ ] Admin: Home / Students / Finance / More; Users screen reachable.
- [ ] Teacher: Home / Attendance / Homework / More; mark → save confirms server-side.
- [ ] Student: Home / Homework / Fees / More; My Profile opens own record only.
- [ ] Staff: Home / Directory / More.
- [ ] Unread badge appears on More; reading clears it.
- [ ] Deep screens (Invoice → Receipt, Homework → Submission) keep back working.

## 5. Money & marks (never fake success)

- [ ] Collect partial → invoice `partial`, balance math exact.
- [ ] Overpay → 422 with balance message; nothing recorded.
- [ ] Airplane mode mid-payment → error shown, NO success UI; server has no payment.
- [ ] Enter marks above max → 422; ranks/grades recompute after save.

## 6. Files

- [ ] Upload PDF/DOCX/JPG (≤15 MB) → appears in list; download opens share sheet.
- [ ] Upload `.exe` / oversize → 422/413 with a clear message.
- [ ] Student cannot download another pupil's file (403).
- [ ] Filenames with `../` / unicode download safely (sanitized server-side).

## 7. Screens & devices

- [ ] Small phone (≤5.4"): login + forms scroll, no clipped buttons.
- [ ] Large phone + tablet (iPad split where supported): cards/lists reflow.
- [ ] Android back button / iOS swipe-back on every stack screen.
- [ ] Rotate on a form: no lost input, no crash.
- [ ] Dark mode: app is light-only by design — verify no unreadable system overlays.
- [ ] Offline: banner shows; cached queries render; mutations fail with retry.

## 8. Release-candidate sign-off

- [ ] `preview` APK on 2 real devices + `preview` iOS on 1 registered iPhone.
- [ ] Fresh install → login → full role walkthrough (§2–§6 abbreviated).
- [ ] Upgrade install (old build → new) preserves session where refresh valid.
- [ ] OTA update applies and reports the new update id (`Updates.updateId`).
- [ ] Production API is HTTPS; staging creds absent; `SECURITY.md` checklist done.
