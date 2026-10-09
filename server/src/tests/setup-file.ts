import { afterAll } from 'vitest';
import { closePool } from '../db';

// Release the (pg-mem) pool after each test file so workers can exit cleanly.
afterAll(async () => {
  await closePool();
});
