import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ApiError } from '@NexusKey/shared';

export const challengesRouter = Router();

challengesRouter.get('/:challengeId', async (req, res, next) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!Number.isInteger(challengeId)) throw new ApiError('VALIDATION_ERROR', 400);
    const result = await pool.query(`SELECT * FROM challenges WHERE challenge_id = $1`, [challengeId]);
    if (result.rows.length === 0) throw new ApiError('CHALLENGE_NOT_FOUND', 404);
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
