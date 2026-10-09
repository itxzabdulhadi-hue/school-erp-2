import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { MulterError } from 'multer';
import { config } from './config';
import { errorHandler, notFound, AppError } from './middleware/errors';
import { router as authRoutes } from './routes/auth';
import { router as schoolRoutes } from './routes/school';
import { router as peopleRoutes } from './routes/people';
import { router as academicsRoutes } from './routes/academics';
import { router as homeworkRoutes } from './routes/homework';
import { router as attendanceRoutes } from './routes/attendance';
import { router as financeRoutes } from './routes/finance';
import { router as commsRoutes } from './routes/comms';
import { router as documentsRoutes } from './routes/documents';

/** Build the Express app. Pool is resolved lazily via db.getPool() (tests inject pg-mem). */
export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(','), credentials: false }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_req, res) => res.json({ data: { status: 'ok', version: '1.0.0' } }));

  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/school', schoolRoutes);
  v1.use('/', peopleRoutes);
  v1.use('/', academicsRoutes);
  v1.use('/', homeworkRoutes);
  v1.use('/attendance', attendanceRoutes);
  v1.use('/', financeRoutes);
  v1.use('/', commsRoutes);
  v1.use('/documents', documentsRoutes);
  app.use('/api/v1', v1);

  // Normalize multer errors into the API error envelope.
  app.use((err: unknown, _req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (err instanceof MulterError) {
      next(new AppError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 422, 'VALIDATION_ERROR', err.message));
      return;
    }
    next(err);
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
