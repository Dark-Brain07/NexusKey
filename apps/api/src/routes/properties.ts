import { Router } from 'express';
import { propertySearchQuerySchema } from '@nexuskey/shared';
import { searchProperties } from '../db/queries.js';
import { pool } from '../db/pool.js';
import { ApiError } from '@nexuskey/shared';

export const propertiesRouter = Router();

propertiesRouter.get('/search', async (req, res, next) => {
  try {
    const query = propertySearchQuerySchema.parse(req.query);
    const { rows, total } = await searchProperties(
      query.q,
      query.city,
      query.stateOrRegion,
      query.page,
      query.pageSize,
    );
    res.json({
      data: rows,
      pagination: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (err) {
    next(err);
  }
});

propertiesRouter.get('/:propertyKey/claims', async (req, res, next) => {
  try {
    const { propertyKey } = req.params;
    const result = await pool.query(
      `SELECT * FROM claims WHERE property_key = $1 ORDER BY created_at_chain DESC`,
      [propertyKey],
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});
