import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, request, resetDatabase, signUp, type TestContext } from './helpers.js';

let ctx: TestContext;
let ann: { cookie: string; userId: string };
let bob: { cookie: string; userId: string };

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ann = await signUp(ctx.app, { name: 'Ann', email: 'ann@example.com' });
  bob = await signUp(ctx.app, { name: 'Bob', email: 'bob@example.com' });
});

async function createWorkspace(cookie: string, body: Record<string, unknown> = { name: 'Team' }) {
  const response = await request(ctx.app, 'POST', '/api/v1/workspaces', { cookie, body });
  expect(response.status).toBe(201);
  return response.body as { id: string; organizationId: string; version: number };
}

describe('workspaces', () => {
  it('creates a workspace in the personal organization and makes the creator admin', async () => {
    const workspace = await createWorkspace(ann.cookie, { name: '  Product  ', description: 'Q4' });
    const personal = await ctx.prisma.organization.findUniqueOrThrow({
      where: { personalOwnerId: ann.userId },
    });
    expect(workspace).toMatchObject({
      name: 'Product',
      description: 'Q4',
      organizationId: personal.id,
      role: 'ADMIN',
      version: 1,
    });

    const list = await request(ctx.app, 'GET', '/api/v1/workspaces', { cookie: ann.cookie });
    expect(list.body).toEqual({ items: [workspace] });
  });

  it('validates input', async () => {
    const response = await request(ctx.app, 'POST', '/api/v1/workspaces', {
      cookie: ann.cookie,
      body: { name: '' },
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('updates a workspace and bumps its version', async () => {
    const workspace = await createWorkspace(ann.cookie);
    const response = await request(ctx.app, 'PATCH', `/api/v1/workspaces/${workspace.id}`, {
      cookie: ann.cookie,
      body: { name: 'Renamed', description: null },
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: 'Renamed', description: null, version: 2 });
  });

  it('deletes a workspace', async () => {
    const workspace = await createWorkspace(ann.cookie);
    const deleted = await request(ctx.app, 'DELETE', `/api/v1/workspaces/${workspace.id}`, {
      cookie: ann.cookie,
    });
    expect(deleted.status).toBe(204);
    const fetched = await request(ctx.app, 'GET', `/api/v1/workspaces/${workspace.id}`, {
      cookie: ann.cookie,
    });
    expect(fetched.status).toBe(404);
  });

  it('reports malformed IDs exactly like missing workspaces', async () => {
    const malformed = await request(ctx.app, 'GET', '/api/v1/workspaces/not-a-uuid', {
      cookie: ann.cookie,
    });
    expect(malformed.status).toBe(404);
    expect(malformed.body).toMatchObject({ error: { code: 'WORKSPACE_NOT_FOUND' } });
  });
});

describe('tenant isolation', () => {
  it("hides another user's workspace entirely", async () => {
    const workspace = await createWorkspace(ann.cookie);

    const list = await request(ctx.app, 'GET', '/api/v1/workspaces', { cookie: bob.cookie });
    expect(list.body).toEqual({ items: [] });

    for (const [method, body] of [
      ['GET', undefined],
      ['PATCH', { name: 'Hijacked' }],
      ['DELETE', undefined],
    ] as const) {
      const response = await request(ctx.app, method, `/api/v1/workspaces/${workspace.id}`, {
        cookie: bob.cookie,
        body,
      });
      expect(response.status, method).toBe(404);
      expect(response.body).toMatchObject({ error: { code: 'WORKSPACE_NOT_FOUND' } });
    }
  });

  it("refuses to create a workspace in someone else's organization", async () => {
    const annOrg = await ctx.prisma.organization.findUniqueOrThrow({
      where: { personalOwnerId: ann.userId },
    });
    const response = await request(ctx.app, 'POST', '/api/v1/workspaces', {
      cookie: bob.cookie,
      body: { name: 'Sneaky', organizationId: annOrg.id },
    });
    expect(response.status).toBe(404);
  });
});

describe('workspace roles', () => {
  it('lets members and viewers read but not manage', async () => {
    const workspace = await createWorkspace(ann.cookie);
    for (const role of ['MEMBER', 'VIEWER'] as const) {
      await ctx.prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: bob.userId } },
        create: { workspaceId: workspace.id, userId: bob.userId, role },
        update: { role },
      });

      const fetched = await request(ctx.app, 'GET', `/api/v1/workspaces/${workspace.id}`, {
        cookie: bob.cookie,
      });
      expect(fetched.body).toMatchObject({ id: workspace.id, role });

      const patched = await request(ctx.app, 'PATCH', `/api/v1/workspaces/${workspace.id}`, {
        cookie: bob.cookie,
        body: { name: 'Nope' },
      });
      expect(patched.status).toBe(403);
      expect(patched.body).toMatchObject({ error: { code: 'FORBIDDEN' } });

      const deleted = await request(ctx.app, 'DELETE', `/api/v1/workspaces/${workspace.id}`, {
        cookie: bob.cookie,
      });
      expect(deleted.status).toBe(403);
    }
  });

  it('gives organization admins admin access to every workspace in the organization', async () => {
    const workspace = await createWorkspace(ann.cookie);
    await ctx.prisma.organizationMember.create({
      data: { organizationId: workspace.organizationId, userId: bob.userId, role: 'ADMIN' },
    });

    const list = await request(ctx.app, 'GET', '/api/v1/workspaces', { cookie: bob.cookie });
    expect(list.body).toMatchObject({ items: [{ id: workspace.id, role: 'ADMIN' }] });
  });
});
