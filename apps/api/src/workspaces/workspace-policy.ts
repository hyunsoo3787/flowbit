import type { OrganizationRole, WorkspaceRole } from '@flowbit/shared';

/**
 * The caller's effective role in a workspace (see docs/ARCHITECTURE.md,
 * "Authorization"). Organization owners and admins administer every workspace
 * in their organization; everyone else needs an explicit workspace membership.
 * Returns null when the caller has no access at all.
 */
export function effectiveWorkspaceRole(
  organizationRole: OrganizationRole | null,
  workspaceRole: WorkspaceRole | null,
): WorkspaceRole | null {
  if (organizationRole === 'OWNER' || organizationRole === 'ADMIN') return 'ADMIN';
  return workspaceRole;
}

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === 'ADMIN';
}

/** Any organization member may create workspaces. Org-level policies arrive in phase 6. */
export function canCreateWorkspaceIn(organizationRole: OrganizationRole | null): boolean {
  return organizationRole !== null;
}
