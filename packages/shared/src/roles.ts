import { z } from 'zod';

export const ORGANIZATION_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES);

export const WORKSPACE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export const BOARD_ROLES = ['ADMIN', 'MEMBER', 'OBSERVER'] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];
export const boardRoleSchema = z.enum(BOARD_ROLES);
