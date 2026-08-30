import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Applied globally to the public API. Search and read endpoints are the
 * most exposed surface (no auth required by design — public verification
 * lookups must not require a wallet), so this is the primary defense
 * against scraping/abuse rather than per-route tuning in V1.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
});
