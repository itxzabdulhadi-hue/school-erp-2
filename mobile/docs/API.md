# School ERP API — mobile integration guide

Base URL: `EXPO_PUBLIC_API_URL` + `/api/v1`. Machine-readable contract:
[`server/openapi.yaml`](../../server/openapi.yaml). Health check: `GET /healthz`.

## Conventions

- **Envelopes** — success: `{ "data": … }`; failure:
  `{ "error": { "code", "message", "details" } }`.
- **IDs** are opaque strings. **Dates** are `YYYY-MM-DD`; timestamps are ISO-8601.
- **Money** is a number in the school currency (no floats-in-strings).
- **Errors** — `VALIDATION_ERROR` (422, zod details), `UNAUTHENTICATED` (401),
  `FORBIDDEN` (403, names the missing permission), `NOT_FOUND` (404),
  `CONFLICT` (409), `RATE_LIMITED` (429, login only), `SERVER_ERROR` (500).
  The mobile client (`src/api/client.ts`) maps these to `ApiError` kinds.

## Authentication

Short-lived JWT access tokens (15 min) + rotating refresh tokens (30 days).

```bash
# 1. Login (schoolSlug only needed if the email exists in several schools)
curl -X POST $API/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@sunrise.edu","password":"School@123","schoolSlug":"sunrise"}'
# → { data: { accessToken, refreshToken, user, permissions } }

# 2. Authenticated calls
curl $API/api/v1/auth/me -H "Authorization: Bearer <accessToken>"

# 3. Refresh (single-use rotation; reuse of an old token fails closed)
curl -X POST $API/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'

# 4. Logout (revokes the refresh token)
curl -X POST $API/api/v1/auth/logout \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

Client rules (already implemented in `src/auth/session.tsx`):

1. Attach `Authorization: Bearer <access>` to everything except login, refresh,
   logout, and `/school/public`.
2. On **401**: refresh once (single-flight across concurrent calls), retry once,
   else sign out. Never loop refreshes.
3. Store tokens in **SecureStore** only (never AsyncStorage, never logs).
4. Treat a mutation as done **only** after a 2xx response. No optimistic writes.

## Authorization

Permissions are `module.action` strings (`students.view`, `fees.create`, …).
`/auth/me` returns the caller's list (admins get `*`). The app gates UI with
`can()` (`src/auth/permissions.ts`), but the **server re-checks every call** —
hiding a button is never a security boundary.

Role scoping is also server-side: e.g. `GET /students` for a student returns
only their own record, and `GET /results?studentId=<other>` is forced to self.

## White-label bootstrap

`GET /school/public?slug=sunrise` (no auth) returns name, logo, colors,
currency — everything the login screen needs. `GET /school` (authed) adds the
grading scale and settings. See `docs/BRANDING.md`.

## Endpoint map (v1)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login|refresh|logout`, `GET /auth/me` |
| School | `GET /school/public`, `GET /school` |
| People | `GET /students[?classId,sectionId,status,search]`, `GET/PATCH /students/:id`, `POST /students`, `GET /teachers[/:id]`, `GET /staff[/:id]`, `GET/POST/PATCH /users` |
| Classes | `GET /classes`, `GET /subjects[?classId]` |
| Timetable | `GET /timetable[?classId,sectionId,teacherId,mine]` |
| Exams | `GET /exams`, `GET /exams/:id[?classId]`, `POST /exams`, `POST /exam-schedules` |
| Results | `GET /results?examId&classId[&studentId]`, `POST /marks`, `POST /marks/bulk` |
| Attendance | `GET /attendance?date[&classId,sectionId,subjectId]`, `GET /attendance/me[?from,to]`, `GET /attendance/summary?studentId[&from,to]`, `POST /attendance/bulk` |
| Finance | `GET/POST /fee-types`, `GET /invoices[?…]`, `GET /invoices/:id`, `POST/PATCH /invoices`, `GET /payments[?…]`, `POST /payments`, `GET /receipts/:paymentId` |
| Homework | `GET/POST /homework`, `GET/PATCH /homework/:id`, `POST /homework/:id/attachment`, `GET …/attachment`, `GET /homework/:id/submissions`, `POST …/submissions`, `PATCH /submissions/:id`, `GET /submissions/:id/file` |
| Materials | `GET /materials`, `POST /materials`, `GET /materials/:id/download` |
| Comms | `GET/POST /announcements`, `DELETE /announcements/:id`, `GET/POST /events`, `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `POST /notifications/broadcast`, `POST/DELETE /devices` |
| Documents | `GET /documents`, `POST /documents`, `GET /documents/:id/download`, `DELETE /documents/:id` |

## File uploads & downloads

- Uploads are `multipart/form-data` with field name **`file`** (+ plain fields).
  Max 15 MB; PDF/images/Office/text/zip only — the server re-validates.
- Downloads are permission-checked `GET …/download` routes (never static URLs);
  the app sends the `Authorization` header via `expo-file-system` and opens the
  OS share sheet. Uploaded files live outside any static route on the server.

## Versioning

Breaking changes ship as `/api/v2` with the old version kept until all
released apps migrate (checklist in `docs/TESTING.md`). Additive fields are
fine within v1 — clients must ignore unknown JSON keys.

## Roadmap (not in v1)

Leaves, library circulation, transport tracking, inventory, discipline, and
messages are web-ERP modules without v1 endpoints yet. The mobile app shows
only what the API serves; `server/README.md` tracks the rollout order.
