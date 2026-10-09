# School ERP API (backend)

Express REST + PostgreSQL + JWT backend serving the Expo mobile apps
(`../mobile`). Strict TypeScript, zod validation, server-enforced RBAC,
permission-checked file uploads. Contract: [`openapi.yaml`](openapi.yaml),
integration guide: [`../mobile/docs/API.md`](../mobile/docs/API.md).

> The existing web ERP (`../src`) is local-first and untouched. This API is the
> shared backend going forward; migrating the web app onto it is explicitly
> roadmap (same DTO names were chosen to make that mechanical).

## Quick start

```bash
cp .env.example .env        # set DATABASE_URL + JWT secrets
npm install

# Option A — dockerized Postgres + API
docker compose up -d        # db :5432, api :4000 (auto-migrates on boot)
docker compose exec api npm run seed   # demo school + logins

# Option B — local Postgres
createdb school_erp
npm run migrate && npm run seed:fresh && npm run dev
```

Demo logins (password = `DEMO_SEED_PASSWORD`, default `School@123`):
`admin@sunrise.edu`, `ayesha.khan@sunrise.edu`, `student@sunrise.edu`,
`kamran.ali@sunrise.edu`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | tsx watch (:4000, auto-migrates) |
| `npm run build` / `npm start` | Compile to `dist/` / run production |
| `npm run migrate` | Apply `src/migrations.sql` (idempotent) |
| `npm run seed` / `seed:fresh` | Demo dataset (additive / wipe-then-seed) |
| `npm test` | vitest suite (in-memory Postgres via pg-mem) |
| `npx tsx src/smoke.ts` | Runner-free verification of critical flows |
| `npm run typecheck` | Strict `tsc --noEmit` |

## Architecture

```
server/
  src/
    index.ts / app.ts        # boot (migrate → listen) + route wiring
    config.ts / db.ts        # env + pg pool, camelCase rows, tx() helper
    migrations.sql           # full schema (20 tables, school-scoped FKs)
    auth/                    # bcrypt passwords, JWT access + rotating refresh, RBAC matrix
    middleware/              # authenticate, requirePerm, zod validate, multer upload, errors
    routes/                  # auth, school, people, academics, homework(+materials),
                             # attendance, finance, comms(+devices/push), documents, files
    lib/grading.ts           # server-side grade bands (mirrors web semantics)
    seed/seed.ts             # coherent demo dataset
    tests/                   # auth, permissions, finance, results, attendance, homework, docs
  Dockerfile / docker-compose.yml / openapi.yaml / .env.example
```

Key decisions:

- **School isolation is structural**: every table carries `school_id`, every
  query scopes to the JWT's school, and role-students are force-scoped to
  their linked record (query params cannot widen scope).
- **Money integrity**: payments run in a transaction, reject overpayment, and
  recompute invoice `paid`/`status` server-side — the client only renders
  what the server confirms.
- **Uploads**: randomized names under `UPLOAD_DIR` (outside any static route),
  15 MB cap, allow-listed MIME types, served only after permission checks.
- **Push**: Expo tokens stored per user; broadcasts fan out per-user rows
  (personal read-state) with best-effort Expo push delivery.

## Deployment notes

- Set `NODE_ENV=production` (startup asserts real `DATABASE_URL` + 32-char JWT
  secrets), run behind TLS, and restrict `CORS_ORIGIN` to known callers.
- `docker-compose.yml` is a starting point — for production use managed
  Postgres (backups, PITR), a persistent volume for `uploads/` (or S3-compatible
  storage later), and log shipping.
- In-memory login throttle is per-process; put Redis in front when scaling out.

## Roadmap

v1 covers what the mobile apps need. Next, in order: leaves, library
circulation, transport, inventory, discipline, messages — then the web-app
migration onto these endpoints.
