import { z } from 'zod';

/**
 * Browser-safe environment. Only NEXT_PUBLIC_* variables may appear here —
 * anything else must live in a server-only module (e.g. a Next.js Route
 * Handler reading process.env directly) and never be imported by a
 * client component. This file is the single point where that boundary is
 * enforced in code, not just convention.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_GENLAYER_NETWORK: z.string().min(1),
  NEXT_PUBLIC_GENLAYER_RPC_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional()
    .or(z.literal('')),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional().or(z.literal('')),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

function loadPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GENLAYER_NETWORK: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
    NEXT_PUBLIC_GENLAYER_RPC_URL: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL,
    NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  });
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid public environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Public environment validation failed.');
  }
  return parsed.data;
}

export const publicEnv = loadPublicEnv();

/**
 * True once a real deployed contract address has been configured. Every
 * chain-writing UI surface (claim form, challenge form) must check this
 * and render a documented "contract not yet configured" state instead of
 * attempting a call against an empty/placeholder address.
 */
export const isContractConfigured = Boolean(publicEnv.NEXT_PUBLIC_NexusKey_CONTRACT_ADDRESS);
