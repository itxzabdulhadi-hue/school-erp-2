import 'dotenv/config';
import { migrateAndClose } from './migrate';

migrateAndClose()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Migrations applied.');
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err);
    process.exit(1);
  });
