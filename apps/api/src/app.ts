import express, { type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { env } from './config/env.js';
import { healthRouter } from './health/routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { apiRouter } from './routes/index.js';

/**
 * Builds the Express app without starting a listener or the indexer --
 * separated from index.ts so tests can exercise real route/middleware
 * behavior via supertest without booting the always-on process.
 */
export function createApp(): Express {
  const app = express();

  app.use(
    pinoHttp({
      level: env.LOG_LEVEL,
      autoLogging: { ignore: (req: IncomingMessage) => req.url?.startsWith('/health') ?? false },
    }),
  );
  app.use(
    cors({
      origin: env.API_CORS_ALLOWED_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(globalRateLimiter);

  app.use('/health', healthRouter);
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
