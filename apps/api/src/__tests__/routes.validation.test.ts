import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/pool.js';

const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('GET /api/v1/claims/:claimId', () => {
  it('rejects a non-numeric claimId with a validation error, not a 500', async () => {
    const res = await request(app).get('/api/v1/claims/not-a-number');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 with CLAIM_NOT_FOUND for a well-formed but nonexistent claim id', async () => {
    const res = await request(app).get('/api/v1/claims/999999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLAIM_NOT_FOUND');
  });
});

describe('GET /api/v1/challenges/:challengeId', () => {
  it('rejects a non-numeric challengeId', async () => {
    const res = await request(app).get('/api/v1/challenges/nope');
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent challenge', async () => {
    const res = await request(app).get('/api/v1/challenges/999999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CHALLENGE_NOT_FOUND');
  });
});

describe('GET /api/v1/wallets/:address/claims', () => {
  it('rejects a malformed wallet address instead of querying the database with it', async () => {
    const res = await request(app).get('/api/v1/wallets/not-an-address/claims');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns an empty array for a valid but unused wallet address', async () => {
    const res = await request(app).get(
      '/api/v1/wallets/0x0000000000000000000000000000000000000001/claims',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/v1/properties/search', () => {
  it('returns paginated empty results for an unmatched query, never a 500', async () => {
    const res = await request(app).get('/api/v1/properties/search?q=nonexistentxyz123');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 0 });
  });

  it('rejects an out-of-range pageSize', async () => {
    const res = await request(app).get('/api/v1/properties/search?pageSize=999');
    expect(res.status).toBe(400);
  });
});
