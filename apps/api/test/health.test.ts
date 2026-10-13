import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, request, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.app.close();
});

describe('health', () => {
  it('reports the database status without authentication', async () => {
    const response = await request(ctx.app, 'GET', '/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', checks: { database: 'up' } });
  });

  it('returns JSON errors for unknown API routes', async () => {
    const response = await request(ctx.app, 'GET', '/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('serves the OpenAPI document', async () => {
    const response = await request(ctx.app, 'GET', '/api/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(['paths', '/api/v1/workspaces']);
  });
});
