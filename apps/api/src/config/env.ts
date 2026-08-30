import { z } from 'zod';

/**
 * All backend environment variables are validated once at process startup.
 * If a required variable is missing or malformed, the process fails fast
 * with a clear message instead of surfacing a confusing runtime error
 * later — important for a service that is expected to run 24/7 on Fly.io,
 * since a bad deploy should be caught by the health check immediately,
 * not after the first real request touches the missing config.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  API_CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1, 'API_CORS_ALLOWED_ORIGINS must list at least one origin')
    .transform((val) => val.split(',').map((s) => s.trim())),

  DATABASE_URL: z.string().url('DATABASE_URL must be a valid postgres:// connection string'),

  GENLAYER_RPC_URL: z.string().url().optional(),
  NexusKey_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),

  EVIDENCE_FETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  EVIDENCE_FETCH_MAX_BYTES: z.coerce.number().int().min(1000).default(2_000_000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(60),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MONITORING_DSN: z.string().optional(),

  AUTH_SESSION_SECRET: z
    .string()
    .min(32, 'AUTH_SESSION_SECRET must be at least 32 characters')
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:\n', parsed.error.flatten().fieldErrors);
    throw new Error('Environment validation failed — see printed field errors above.');
  }
  return parsed.data;
}

export const env = loadEnv();

/**
 * The contract address is deliberately allowed to be unset at startup
 * (per NexusKey's rule: never hardcode a contract address before it is
 * provided). Any route that needs it must call this guard, which fails
 * with a clear, typed error rather than silently calling an undefined
 * address.
 */
export function requireContractAddress(): string {
  if (!env.NexusKey_CONTRACT_ADDRESS) {
    throw new Error(
      'NexusKey_CONTRACT_ADDRESS is not configured. Deploy the NexusKey Intelligent ' +
        'Contract to StudioNet and set NexusKey_CONTRACT_ADDRESS before using ' +
        'chain-dependent routes.',
    );
  }
  return env.NexusKey_CONTRACT_ADDRESS;
}

export function requireGenlayerRpcUrl(): string {
  if (!env.GENLAYER_RPC_URL) {
    throw new Error('GENLAYER_RPC_URL is not configured.');
  }
  return env.GENLAYER_RPC_URL;
}
