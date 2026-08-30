import { Router } from 'express';
import { propertiesRouter } from './properties.js';
import { claimsRouter } from './claims.js';
import { challengesRouter } from './challenges.js';
import { walletsRouter } from './wallets.js';

/**
 * This backend never exposes a write endpoint for claim/challenge/bond
 * actions -- those go wallet -> contract directly per the trust boundary
 * defined in ARCHITECTURE.md. Everything mounted here is a read-only
 * index of chain state.
 */
export const apiRouter = Router();

apiRouter.use('/properties', propertiesRouter);
apiRouter.use('/claims', claimsRouter);
apiRouter.use('/challenges', challengesRouter);
apiRouter.use('/wallets', walletsRouter);
