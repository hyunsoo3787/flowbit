import { describe, expect, it } from 'vitest';
import {
  canCreateBoardIn,
  canEditContent,
  canManageBoard,
  effectiveBoardRole,
} from './board-policy.js';

const none = { organizationRole: null, workspaceRole: null, boardRole: null } as const;

describe('effectiveBoardRole', () => {
  it('makes organization owners and admins board admins, even on private boards', () => {
    expect(effectiveBoardRole({ ...none, organizationRole: 'OWNER', visibility: 'PRIVATE' })).toBe(
      'ADMIN',
    );
    expect(effectiveBoardRole({ ...none, organizationRole: 'ADMIN', visibility: 'PRIVATE' })).toBe(
      'ADMIN',
    );
  });

  it('derives a role from the workspace only for workspace-visible boards', () => {
    expect(effectiveBoardRole({ ...none, workspaceRole: 'VIEWER', visibility: 'WORKSPACE' })).toBe(
      'OBSERVER',
    );
    expect(
      effectiveBoardRole({ ...none, workspaceRole: 'ADMIN', visibility: 'PRIVATE' }),
    ).toBeNull();
  });

  it('takes the highest of board and workspace roles', () => {
    expect(
      effectiveBoardRole({
        ...none,
        workspaceRole: 'MEMBER',
        boardRole: 'OBSERVER',
        visibility: 'WORKSPACE',
      }),
    ).toBe('MEMBER');
    expect(
      effectiveBoardRole({
        ...none,
        workspaceRole: 'VIEWER',
        boardRole: 'ADMIN',
        visibility: 'WORKSPACE',
      }),
    ).toBe('ADMIN');
  });

  it('gives private board members their board role', () => {
    expect(effectiveBoardRole({ ...none, boardRole: 'MEMBER', visibility: 'PRIVATE' })).toBe(
      'MEMBER',
    );
  });

  it('denies access without any membership', () => {
    expect(
      effectiveBoardRole({ ...none, organizationRole: 'MEMBER', visibility: 'WORKSPACE' }),
    ).toBeNull();
  });
});

describe('board capabilities', () => {
  it('lets members and admins edit content, observers only read', () => {
    expect(canEditContent('ADMIN')).toBe(true);
    expect(canEditContent('MEMBER')).toBe(true);
    expect(canEditContent('OBSERVER')).toBe(false);
  });

  it('lets only admins manage the board', () => {
    expect(canManageBoard('ADMIN')).toBe(true);
    expect(canManageBoard('MEMBER')).toBe(false);
  });

  it('lets workspace admins and members create boards', () => {
    expect(canCreateBoardIn('ADMIN')).toBe(true);
    expect(canCreateBoardIn('MEMBER')).toBe(true);
    expect(canCreateBoardIn('VIEWER')).toBe(false);
    expect(canCreateBoardIn(null)).toBe(false);
  });
});
