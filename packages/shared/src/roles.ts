import { z } from 'zod';

export const ORGANIZATION_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES);

export const WORKSPACE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);
