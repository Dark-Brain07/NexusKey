import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/pool.js';

const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('GET /health/live', () => {
  it('returns 200 with no database dependency', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /health/ready', () => {
  it('returns 200 and reports the database reachable', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', database: 'reachable' });
  });
});

describe('unmatched routes', () => {
  it('returns a structured 404, not an HTML error page', async () => {
    const res = await request(app).get('/api/v1/definitely-not-a-real-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
