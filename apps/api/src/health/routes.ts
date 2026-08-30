import { Router } from 'express';
import { checkDatabaseHealth } from '../db/pool.js';

/**
 * Health endpoints consumed by Fly.io's HTTP health checks (see fly.toml).
 * /health/live answers "is the process alive" with no dependency checks —
 * used for Fly's restart-on-failure behavior, so a slow database never
 * causes an unnecessary process restart. /health/ready additionally checks
 * the database and is used for the load-balancer routing decision.
 */
export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/ready', async (_req, res) => {
  const dbHealthy = await checkDatabaseHealth();
  if (!dbHealthy) {
    res.status(503).json({ status: 'not_ready', database: 'unreachable' });
    return;
  }
  res.status(200).json({ status: 'ready', database: 'reachable' });
});
