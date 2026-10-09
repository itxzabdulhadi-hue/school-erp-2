import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { config } from './config';

let pool: Pool | undefined;

/** Initialize (or return) the shared pg Pool. Tests inject a pg-mem pool via setPool. */
export function getPool(): Pool {
  if (!pool) {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is not set');
    pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
  }
  return pool;
}

export function setPool(p: Pool): void {
  pool = p;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => undefined);
    pool = undefined;
  }
}

type Ctx = Pool | PoolClient;

function ctx(): Ctx {
  return getPool();
}

/** Raw rows (snake_case). Prefer q()/one() which return camelCase app objects. */
export async function raw<T extends QueryResultRow = QueryResultRow>(
  text: string, params: unknown[] = [], c: Ctx = ctx(),
): Promise<T[]> {
  const res = await c.query<T>(text, params as unknown[]);
  return res.rows;
}

const NUMERIC_KEYS = new Set([
  'subtotal', 'discount', 'tax', 'total', 'paid', 'amount', 'balance',
  'obtained_marks', 'max_marks', 'passing_marks', 'qty', 'score',
  'periods_per_week', 'capacity', 'credit_hours', 'size_bytes',
  'day_of_week', 'numeric_order', 'count',
]);

const snakeToCamel = (s: string): string => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function convertValue(key: string, value: unknown): unknown {
  if (value instanceof Date) {
    // *_at columns are timestamps; all other dates are calendar dates (YYYY-MM-DD).
    return key.endsWith('_at') ? value.toISOString() : value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && NUMERIC_KEYS.has(key) && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

/** Map a snake_case row to camelCase, normalizing dates and numerics. */
export function toCamel<T = Record<string, unknown>>(row: QueryResultRow): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[snakeToCamel(k)] = convertValue(k, v);
  return out as T;
}

/** Query returning camelCase rows. */
export async function q<T = Record<string, unknown>>(
  text: string, params: unknown[] = [], c?: Ctx,
): Promise<T[]> {
  const rows = await raw(text, params, c ?? ctx());
  return rows.map((r) => toCamel<T>(r));
}

/** Query returning the first camelCase row or null. */
export async function one<T = Record<string, unknown>>(
  text: string, params: unknown[] = [], c?: Ctx,
): Promise<T | null> {
  const rows = await q<T>(text, params, c);
  return rows[0] ?? null;
}

/** Run a callback inside a transaction. Rolls back on any error. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
