import 'dotenv/config';
import { createApp } from './app';
import { assertProductionSecrets, config } from './config';
import { closePool } from './db';
import { runMigrations } from './migrate';

// eslint-disable-next-line no-console
const log = console.log;

async function main(): Promise<void> {
  assertProductionSecrets();
  await runMigrations();
  log('Database schema ready.');
  const app = createApp();
  const server = app.listen(config.port, () => {
    log(`School ERP API listening on :${config.port} (${config.nodeEnv})`);
  });
  const shutdown = async (): Promise<void> => {
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
