import type { BoardRole, BoardVisibility, OrganizationRole, WorkspaceRole } from '@flowbit/shared';

const RANK: Record<BoardRole, number> = { OBSERVER: 1, MEMBER: 2, ADMIN: 3 };

const BOARD_ROLE_FROM_WORKSPACE: Record<WorkspaceRole, BoardRole> = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'OBSERVER',
};

/**
 * The caller's effective role on a board (docs/ARCHITECTURE.md, "Authorization"):
 * organization owners and admins administer every board; otherwise the highest
 * of the explicit board membership and, for workspace-visible boards, the role
 * derived from the workspace membership. Returns null when the caller has no access.
 */
export function effectiveBoardRole(input: {
  organizationRole: OrganizationRole | null;
  workspaceRole: WorkspaceRole | null;
  boardRole: BoardRole | null;
  visibility: BoardVisibility;
}): BoardRole | null {
  if (input.organizationRole === 'OWNER' || input.organizationRole === 'ADMIN') return 'ADMIN';
  const candidates: BoardRole[] = [];
  if (input.boardRole) candidates.push(input.boardRole);
  if (input.visibility === 'WORKSPACE' && input.workspaceRole) {
    candidates.push(BOARD_ROLE_FROM_WORKSPACE[input.workspaceRole]);
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((best, role) => (RANK[role] > RANK[best] ? role : best));
}

/** Create, edit, move and delete lists and cards. */
export function canEditContent(role: BoardRole): boolean {
  return role === 'ADMIN' || role === 'MEMBER';
}

/** Rename, change visibility or background, delete the board. */
export function canManageBoard(role: BoardRole): boolean {
  return role === 'ADMIN';
}

export function canCreateBoardIn(workspaceRole: WorkspaceRole | null): boolean {
  return workspaceRole === 'ADMIN' || workspaceRole === 'MEMBER';
}
