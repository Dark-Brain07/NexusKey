import { Router } from 'express';
import { walletAddressSchema } from '@nexuskey/shared';
import { getClaimsByWallet, getChallengesByWallet } from '../db/queries.js';
import { ApiError } from '@nexuskey/shared';

/**
 * Public reads keyed by wallet address -- not a "/users/me" pattern
 * requiring a session, because claim/challenge data (including the
 * claimant/challenger wallet itself) is public by design. The frontend
 * already knows its own connected address from the wallet session and
 * queries directly by it; no separate auth token adds anything here.
 */
export const walletsRouter = Router();

walletsRouter.get('/:address/claims', async (req, res, next) => {
  try {
    const address = walletAddressSchema.parse(req.params.address);
    const rows = await getClaimsByWallet(address);
    res.json({ data: rows });
  } catch {
    next(new ApiError('VALIDATION_ERROR', 400));
  }
});

walletsRouter.get('/:address/challenges', async (req, res, next) => {
  try {
    const address = walletAddressSchema.parse(req.params.address);
    const rows = await getChallengesByWallet(address);
    res.json({ data: rows });
  } catch {
    next(new ApiError('VALIDATION_ERROR', 400));
  }
});
