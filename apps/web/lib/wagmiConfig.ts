import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { studionet } from 'genlayer-js/chains';
import { publicEnv } from './env';

/**
 * GenLayer StudioNet, using genlayer-js's own chain definition rather than
 * a hand-rolled one -- it carries the consensus contract addresses/ABIs
 * genlayer-js needs internally for transaction handling, which would be
 * wrong to guess. If NEXT_PUBLIC_GENLAYER_RPC_URL is set (e.g. to point at
 * a different GenLayer network), it overrides the SDK's default RPC.
 */
export const studioNetChain = publicEnv.NEXT_PUBLIC_GENLAYER_RPC_URL
  ? {
      ...studionet,
      rpcUrls: { default: { http: [publicEnv.NEXT_PUBLIC_GENLAYER_RPC_URL] } },
    }
  : studionet;

export const wagmiConfig = getDefaultConfig({
  appName: 'NexusKey',
  projectId: publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'NexusKey-dev-placeholder',
  chains: [studioNetChain],
  ssr: true,
});
