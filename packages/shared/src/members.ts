import { z } from 'zod';
import { boardRoleSchema, workspaceRoleSchema } from './roles.js';

/** A person as shown next to their work: avatars, assignees, mentions. */
export const userSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const workspaceMemberSchema = z.object({
  user: userSummarySchema,
  role: workspaceRoleSchema,
  joinedAt: z.iso.datetime(),
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const workspaceMemberListSchema = z.object({ items: z.array(workspaceMemberSchema) });
export type WorkspaceMemberList = z.infer<typeof workspaceMemberListSchema>;

export const updateWorkspaceMemberSchema = z.object({ role: workspaceRoleSchema });
export type UpdateWorkspaceMemberInput = z.infer<typeof updateWorkspaceMemberSchema>;

/**
 * Someone with access to a board. `role` is their effective role; `boardRole`
 * is their explicit board membership, if any (the rest comes from the workspace).
 */
export const boardMemberSchema = z.object({
  user: userSummarySchema,
  role: boardRoleSchema,
  boardRole: boardRoleSchema.nullable(),
});
export type BoardMember = z.infer<typeof boardMemberSchema>;

export const boardMemberListSchema = z.object({ items: z.array(boardMemberSchema) });
export type BoardMemberList = z.infer<typeof boardMemberListSchema>;

/** Adds a workspace member to a board, or changes their explicit board role. */
export const setBoardMemberSchema = z.object({ role: boardRoleSchema });
export type SetBoardMemberInput = z.infer<typeof setBoardMemberSchema>;

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/** How many people one request can invite by email. */
export const INVITATION_EMAILS_MAX = 20;
export const INVITATION_EMAIL_DAYS = 7;
export const INVITATION_LINK_DAYS = 30;

export const inviteToWorkspaceSchema = z.object({
  emails: z.array(z.email()).min(1).max(INVITATION_EMAILS_MAX),
  role: workspaceRoleSchema.default('MEMBER'),
});
export type InviteToWorkspaceInput = z.input<typeof inviteToWorkspaceSchema>;

export const inviteToBoardSchema = z.object({
  emails: z.array(z.email()).min(1).max(INVITATION_EMAILS_MAX),
  role: boardRoleSchema.default('MEMBER'),
});
export type InviteToBoardInput = z.input<typeof inviteToBoardSchema>;

export const workspaceInvitationLinkSchema = z.object({
  role: workspaceRoleSchema.default('MEMBER'),
});
export type WorkspaceInvitationLinkInput = z.input<typeof workspaceInvitationLinkSchema>;

export const boardInvitationLinkSchema = z.object({ role: boardRoleSchema.default('MEMBER') });
export type BoardInvitationLinkInput = z.input<typeof boardInvitationLinkSchema>;

/** A pending invitation, as its workspace or board admins see it. */
export const invitationSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  boardId: z.uuid().nullable(),
  /** Null for a shareable link. */
  email: z.email().nullable(),
  role: z.union([workspaceRoleSchema, boardRoleSchema]),
  /** The link to accept the invitation. */
  url: z.url(),
  invitedBy: userSummarySchema.nullable(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const invitationListSchema = z.object({ items: z.array(invitationSchema) });
export type InvitationList = z.infer<typeof invitationListSchema>;

/** What an invitation leads to, shown before accepting it. */
export const invitationPreviewSchema = z.object({
  kind: z.enum(['workspace', 'board']),
  workspaceName: z.string(),
  boardName: z.string().nullable(),
  invitedByName: z.string().nullable(),
  /** Set for email invitations: only this address can accept. */
  email: z.email().nullable(),
  expiresAt: z.iso.datetime(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const acceptedInvitationSchema = z.object({
  workspaceId: z.uuid().nullable(),
  boardId: z.uuid().nullable(),
});
export type AcceptedInvitation = z.infer<typeof acceptedInvitationSchema>;
