import { z } from 'zod';
import { workspaceRoleSchema } from './roles.js';

export const WORKSPACE_NAME_MAX_LENGTH = 100;
export const WORKSPACE_DESCRIPTION_MAX_LENGTH = 500;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(WORKSPACE_NAME_MAX_LENGTH),
  description: z.string().trim().max(WORKSPACE_DESCRIPTION_MAX_LENGTH).optional(),
  /** Defaults to the caller's personal organization. */
  organizationId: z.uuid().optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = createWorkspaceSchema
  .omit({ organizationId: true })
  .partial()
  .extend({
    description: z.string().trim().max(WORKSPACE_DESCRIPTION_MAX_LENGTH).nullable().optional(),
  });
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const workspaceSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  /** The caller's effective role in this workspace. */
  role: workspaceRoleSchema,
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const workspaceListSchema = z.object({
  items: z.array(workspaceSchema),
});
export type WorkspaceList = z.infer<typeof workspaceListSchema>;
