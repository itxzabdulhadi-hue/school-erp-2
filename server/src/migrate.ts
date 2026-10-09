import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { closePool, getPool } from './db';

function migrationSql(): string {
  const candidates = [
    join(__dirname, 'migrations.sql'), // tsx / dev (src/)
    join(__dirname, '..', 'src', 'migrations.sql'), // tests (src/tests/)
    join(process.cwd(), 'dist', 'migrations.sql'), // built output
    join(process.cwd(), 'src', 'migrations.sql'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  throw new Error('migrations.sql not found');
}

/** Run the idempotent schema migration, one statement at a time. */
export async function runMigrations(): Promise<void> {
  const statements = migrationSql()
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const pool = getPool();
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

export async function migrateAndClose(): Promise<void> {
  await runMigrations();
  await closePool();
}
