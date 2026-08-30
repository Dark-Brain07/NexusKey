import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ApiError, challengeableClaimsQuerySchema } from '@nexuskey/shared';
import { listChallengeableClaims } from '../db/queries.js';

export const claimsRouter = Router();

// Must be registered before the /:claimId route, otherwise Express would
// match "challengeable" as a claimId param.
claimsRouter.get('/challengeable', async (req, res, next) => {
  try {
    const query = challengeableClaimsQuerySchema.parse(req.query);
    const { rows, total } = await listChallengeableClaims(query.page, query.pageSize);
    res.json({ data: rows, pagination: { page: query.page, pageSize: query.pageSize, total } });
  } catch (err) {
    next(err);
  }
});

claimsRouter.get('/:claimId', async (req, res, next) => {
  try {
    const claimId = Number(req.params.claimId);
    if (!Number.isInteger(claimId)) throw new ApiError('VALIDATION_ERROR', 400);
    const result = await pool.query(`SELECT * FROM claims WHERE claim_id = $1`, [claimId]);
    if (result.rows.length === 0) throw new ApiError('CLAIM_NOT_FOUND', 404);
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

claimsRouter.get('/:claimId/status', async (req, res, next) => {
  try {
    const claimId = Number(req.params.claimId);
    if (!Number.isInteger(claimId)) throw new ApiError('VALIDATION_ERROR', 400);
    const result = await pool.query(
      `SELECT claim_id, status, verification_expires_at FROM claims WHERE claim_id = $1`,
      [claimId],
    );
    if (result.rows.length === 0) throw new ApiError('CLAIM_NOT_FOUND', 404);
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
