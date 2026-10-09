# School ERP — White-Label School Management System

A complete, production-quality **white-label School ERP** across web, API, and
mobile. One system deploys for any school: all branding (name, logo, colors,
currency, grading, academic structure) flows from configuration — **zero
hardcoding** anywhere in the UI.

## Repository layout

| Project | Path | Stack | Docs |
|---|---|---|---|
| Web ERP | `src/` | React 19, TypeScript, Tailwind, Zustand (local-first, `localStorage`, JSON backup/restore) | Below |
| Backend API | `server/` | Express, PostgreSQL, JWT + RBAC, uploads | [`server/README.md`](server/README.md) · [`server/openapi.yaml`](server/openapi.yaml) |
| Mobile apps | `mobile/` | Expo + React Native + TypeScript (Android APK/AAB, iOS IPA) | [`mobile/README.md`](mobile/README.md) |

The mobile apps are functional clients of `server/` (same data, auth, and
permissions — no mock data). The web ERP remains fully working as a
local-first app; migrating it onto the API is tracked as roadmap.

## Web ERP quick start

## Quick start

```bash
npm install
npm run dev      # development server → http://localhost:5173
npm run build    # type-check + production build
npm run preview  # serve the production build
npm run lint     # oxlint
```

The app ships with a realistic demo dataset (64 students, 14 teachers, 8 staff,
10 classes / 20 sections, fees, exams, marks, attendance, library, transport and more).
Use **Settings → Data → Reset demo data** to restore it at any time.

## White-labeling (rebrand for a new school)

**Option 1 — no code changes:** open **Settings** in the running app and update the
*School* tab (identity, logo, favicon, colors, currency, date/time formats) and the
*Academics* tab (years, terms, grading scales, feature toggles). Everything —
sidebar, login-free shell, print letterheads, report cards, invoices, receipts,
certificates — picks it up instantly.

**Option 2 — ship pre-branded defaults:** edit `src/config/whitelabel.ts`
(a single typed `SchoolSettings` object) and rebuild. No component reads school
identity from anywhere else — use the `useSchool()` / `useMoney()` / `useFmt()` hooks.

## Modules (28)

| Area | Pages |
|---|---|
| Overview | Dashboard (KPIs, charts, alerts), Global search, Notifications |
| People | Students (+ full 360° profiles), Teachers (+ profiles), Staff, Leaves |
| Academics | Classes & sections, Subjects, Timetable (conflict detection), Exams & date-sheets, Results & report cards, Homework, Study materials |
| Finance | Fees (types, structures, invoices, payments, receipts, defaulter tracking) |
| Campus | Library, Transport (routes, vehicles, drivers), Inventory, Discipline |
| Comms | Announcements, Events, Messages (data structure), Notifications (data structure) |
| Records | Certificates (6 types + custom), Documents vault, Reports hub (23 reports) |
| Output | Print center: student profiles, invoices, receipts, report cards, certificates, timetables — all on school letterhead |
| Admin | Settings: school identity, academics, finance, system, data backup/restore |

## Architecture

```
src/
  auth/roles.ts          # Role type + permission matrix (future-ready; NOT enforced — no login yet)
  config/whitelabel.ts   # Default school brand config (single source of truth)
  lib/
    db/types.ts          # ~40 typed entities (single source of truth for the data model)
    db/seed.ts           # Deterministic realistic demo dataset
    db/store.ts          # Zustand store: generic CRUD + domain actions, persisted
    db/selectors.ts      # Derived data: finance, results, attendance, dashboard, conflicts
    useSchool.ts         # Branding hooks (useSchool/useMoney/useFmt/useBranding)
    grading.ts · validation.ts · utils.ts · dates.ts · currency.ts
  components/
    branding/BrandingProvider.tsx  # Applies theme (CSS vars, fonts, favicon, title) at runtime
    layout/ + ui/                  # App shell, sidebar, header, DataTable, Modal, Toast, …
  modules/<name>/<Name>Page.tsx    # One folder per module, lazy-loaded routes
```

Key design decisions:

- **Central data engine** — every module reads/writes the same typed store; IDs link
  students ↔ classes ↔ attendance ↔ fees ↔ exams ↔ library ↔ transport, so all CRUD
  is genuinely interconnected (e.g. recording a payment updates the invoice, the
  student profile, finance reports and the dashboard).
- **Derived statuses refresh on boot** — overdue invoices, due library books and
  expired leaves are recomputed from dates automatically.
- **No auth enforced (by design)** — the spec requires no login/permissions. A role
  + permission matrix already exists in `src/auth/roles.ts` so enforcement can be
  layered on later without refactoring.
- **Documents & messages are metadata-first** — attachments/thread bodies are modeled
  as structured data ready for a real backend, with the UI fully functional today.

## Data & backup

- Local-first: the whole database lives in `localStorage` (`school-erp-db`).
- **Settings → Data** exports the full state as JSON, re-imports it (validated), or
  wipes back to the demo seed.
- Reset clears the stored key and rebuilds the deterministic seed.

## Tech stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS · Zustand (persist) ·
React Router · Recharts · Lucide icons · date-fns · clsx + tailwind-merge

## License

Proprietary — built for Devzard. All rights reserved.
