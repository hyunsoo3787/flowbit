import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import * as shared from '@flowbit/shared';
import { z } from 'zod';

/**
 * Named schemas exposed in the OpenAPI document. The Zod schemas in
 * `@flowbit/shared` are the single source of truth; the web client's types are
 * generated from the resulting document.
 */
const inputSchemas = {
  CreateWorkspaceInput: shared.createWorkspaceSchema,
  UpdateWorkspaceInput: shared.updateWorkspaceSchema,
  UpdateProfileInput: shared.updateProfileSchema,
  CreateBoardInput: shared.createBoardSchema,
  UpdateBoardInput: shared.updateBoardSchema,
  CreateListInput: shared.createListSchema,
  UpdateListInput: shared.updateListSchema,
  MoveListInput: shared.moveListSchema,
  CreateCardInput: shared.createCardSchema,
  UpdateCardInput: shared.updateCardSchema,
  MoveCardInput: shared.moveCardSchema,
  CreateLabelInput: shared.createLabelSchema,
  UpdateLabelInput: shared.updateLabelSchema,
  CreateChecklistInput: shared.createChecklistSchema,
  UpdateChecklistInput: shared.updateChecklistSchema,
  CreateChecklistItemInput: shared.createChecklistItemSchema,
  UpdateChecklistItemInput: shared.updateChecklistItemSchema,
  MoveChecklistItemInput: shared.moveChecklistItemSchema,
  CreateCommentInput: shared.createCommentSchema,
  UpdateCommentInput: shared.updateCommentSchema,
  UpdateWorkspaceMemberInput: shared.updateWorkspaceMemberSchema,
  SetBoardMemberInput: shared.setBoardMemberSchema,
  InviteToWorkspaceInput: shared.inviteToWorkspaceSchema,
  InviteToBoardInput: shared.inviteToBoardSchema,
  WorkspaceInvitationLinkInput: shared.workspaceInvitationLinkSchema,
  BoardInvitationLinkInput: shared.boardInvitationLinkSchema,
  UpdateInstanceSettingsInput: shared.updateInstanceSettingsSchema,
  CompleteSetupInput: shared.completeSetupSchema,
} satisfies Record<string, z.ZodType>;

const outputSchemas = {
  ApiError: z.object({
    error: z.object({
      code: z.enum(shared.ERROR_CODES),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  }),
  AuthConfig: shared.authConfigSchema,
  Health: shared.healthSchema,
  UserProfile: shared.userProfileSchema,
  Workspace: shared.workspaceSchema,
  WorkspaceList: shared.workspaceListSchema,
  Board: shared.boardSchema,
  BoardList: shared.boardListSchema,
  BoardDetail: shared.boardDetailSchema,
  List: shared.listSchema,
  Card: shared.cardSchema,
  Label: shared.labelSchema,
  Checklist: shared.checklistSchema,
  ChecklistList: shared.checklistListSchema,
  ChecklistItem: shared.checklistItemSchema,
  Comment: shared.commentSchema,
  CommentPage: shared.commentPageSchema,
  WorkspaceMemberList: shared.workspaceMemberListSchema,
  WorkspaceMember: shared.workspaceMemberSchema,
  BoardMemberList: shared.boardMemberListSchema,
  BoardMember: shared.boardMemberSchema,
  Invitation: shared.invitationSchema,
  InvitationList: shared.invitationListSchema,
  InvitationPreview: shared.invitationPreviewSchema,
  AcceptedInvitation: shared.acceptedInvitationSchema,
  AdminUserPage: shared.adminUserPageSchema,
  AdminUser: shared.adminUserSchema,
  AdminActionPage: shared.adminActionPageSchema,
  InstanceStats: shared.instanceStatsSchema,
  InstanceSettings: shared.instanceSettingsSchema,
  PasswordResetLink: shared.passwordResetLinkSchema,
  SetupStatus: shared.setupStatusSchema,
} satisfies Record<string, z.ZodType>;

export type SchemaName = keyof typeof inputSchemas | keyof typeof outputSchemas;

/** A `$ref` to a named schema, for use in `@ApiBody` / `@ApiResponse`. */
export function schemaRef(name: SchemaName) {
  return { $ref: `#/components/schemas/${name}` };
}

function toOpenApiSchema(schema: z.ZodType, io: 'input' | 'output') {
  // OpenAPI 3.0 has no `$schema` keyword.
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { target: 'openapi-3.0', io });
  return json;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Flowbit API')
    .setDescription(
      'REST API of Flowbit. Authentication endpoints live under `/api/auth/*` and are provided by Better Auth.',
    )
    .setVersion('1')
    .addCookieAuth('better-auth.session_token')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const schemas: Record<string, unknown> = { ...document.components?.schemas };
  for (const [name, schema] of Object.entries(inputSchemas)) {
    schemas[name] = toOpenApiSchema(schema, 'input');
  }
  for (const [name, schema] of Object.entries(outputSchemas)) {
    schemas[name] = toOpenApiSchema(schema, 'output');
  }
  document.components = { ...document.components, schemas: schemas as never };
  return document;
}
