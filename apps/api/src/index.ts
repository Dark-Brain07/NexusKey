import { env } from './config/env.js';
import { createApp } from './app.js';
import { startIndexer, stopIndexer } from './indexer/worker.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`NexusKey API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

/**
 * The indexer worker runs in-process on an interval rather than as a
 * separate Fly.io machine for V1 — one process to keep alive, one health
 * check, simpler "must never die" story. If indexing volume later requires
 * isolation, this can be split into its own Fly app without changing the
 * indexer's internal logic (see src/indexer/worker.ts).
 */
startIndexer();

/**
 * Graceful shutdown: Fly.io sends SIGTERM before restarting/redeploying a
 * machine. Finishing in-flight requests and closing the DB pool cleanly
 * here is what keeps deploys from dropping active requests, which matters
 * for an "always-on" backend.
 */
function shutdown(signal: string): void {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down gracefully...`);
  // Release the indexer leader lock (if held) so a still-running machine
  // can pick it up immediately instead of waiting for this connection to
  // drop on its own during a rolling redeploy.
  stopIndexer()
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Error releasing indexer lock during shutdown:', err);
    })
    .finally(() => {
      server.close(() => {
        process.exit(0);
      });
    });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', err);
});
