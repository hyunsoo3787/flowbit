import { describe, expect, it } from 'vitest';
import { createWorkspaceSchema } from './workspace.js';

describe('createWorkspaceSchema', () => {
  it('trims the name', () => {
    expect(createWorkspaceSchema.parse({ name: '  Design  ' })).toEqual({ name: 'Design' });
  });

  it('rejects an empty or too long name', () => {
    expect(createWorkspaceSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createWorkspaceSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
  });
});
