import { describe, expect, it } from 'vitest';
import {
  canCreateWorkspaceIn,
  canManageWorkspace,
  effectiveWorkspaceRole,
} from './workspace-policy.js';

describe('effectiveWorkspaceRole', () => {
  it('makes organization owners and admins workspace admins', () => {
    expect(effectiveWorkspaceRole('OWNER', null)).toBe('ADMIN');
    expect(effectiveWorkspaceRole('ADMIN', 'VIEWER')).toBe('ADMIN');
  });

  it('uses the workspace membership for regular organization members', () => {
    expect(effectiveWorkspaceRole('MEMBER', 'VIEWER')).toBe('VIEWER');
    expect(effectiveWorkspaceRole(null, 'MEMBER')).toBe('MEMBER');
  });

  it('denies access without any membership', () => {
    expect(effectiveWorkspaceRole('MEMBER', null)).toBeNull();
    expect(effectiveWorkspaceRole(null, null)).toBeNull();
  });
});

describe('permissions', () => {
  it('only lets admins manage a workspace', () => {
    expect(canManageWorkspace('ADMIN')).toBe(true);
    expect(canManageWorkspace('MEMBER')).toBe(false);
    expect(canManageWorkspace('VIEWER')).toBe(false);
  });

  it('lets any organization member create workspaces', () => {
    expect(canCreateWorkspaceIn('MEMBER')).toBe(true);
    expect(canCreateWorkspaceIn(null)).toBe(false);
  });
});
