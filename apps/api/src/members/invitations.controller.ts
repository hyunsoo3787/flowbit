import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AcceptedInvitation,
  boardInvitationLinkSchema,
  type Invitation,
  type InvitationList,
  type InvitationPreview,
  inviteToBoardSchema,
  inviteToWorkspaceSchema,
  workspaceInvitationLinkSchema,
} from '@flowbit/shared';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { AppError } from '../common/app-error.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { InvitationsService } from './invitations.service.js';

const workspaceIdPipe = new IdParamPipe('WORKSPACE_NOT_FOUND');
const boardIdPipe = new IdParamPipe('BOARD_NOT_FOUND');
const invitationIdPipe = new IdParamPipe('INVITATION_NOT_FOUND');
const tokenSchema = z.string().regex(/^[\w-]{16,64}$/);

/** Malformed tokens are reported like unknown ones. */
const tokenPipe = {
  transform(value: string) {
    if (!tokenSchema.safeParse(value).success) throw AppError.notFound('INVITATION_NOT_FOUND');
    return value;
  },
};

@ApiTags('invitations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get('workspaces/:workspaceId/invitations')
  @ApiJsonResponse(200, 'InvitationList', 401, 403, 404)
  async listForWorkspace(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
  ): Promise<InvitationList> {
    const scope = await this.invitations.workspaceScope(user.id, workspaceId);
    return { items: await this.invitations.list(scope) };
  }

  @Post('workspaces/:workspaceId/invitations')
  @ApiJsonBody('InviteToWorkspaceInput')
  @ApiJsonResponse(201, 'InvitationList', 400, 401, 403, 404)
  async inviteToWorkspace(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
    @Body(new ZodValidationPipe(inviteToWorkspaceSchema))
    input: z.output<typeof inviteToWorkspaceSchema>,
  ): Promise<InvitationList> {
    const scope = await this.invitations.workspaceScope(user.id, workspaceId);
    return { items: await this.invitations.inviteByEmail(user, scope, input.emails, input.role) };
  }

  @Post('workspaces/:workspaceId/invitation-link')
  @ApiJsonBody('WorkspaceInvitationLinkInput')
  @ApiJsonResponse(201, 'Invitation', 400, 401, 403, 404)
  async workspaceLink(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
    @Body(new ZodValidationPipe(workspaceInvitationLinkSchema))
    input: z.output<typeof workspaceInvitationLinkSchema>,
  ): Promise<Invitation> {
    const scope = await this.invitations.workspaceScope(user.id, workspaceId);
    return this.invitations.createLink(user.id, scope, input.role);
  }

  @Get('boards/:boardId/invitations')
  @ApiJsonResponse(200, 'InvitationList', 401, 403, 404)
  async listForBoard(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
  ): Promise<InvitationList> {
    const scope = await this.invitations.boardScope(user.id, boardId);
    return { items: await this.invitations.list(scope) };
  }

  @Post('boards/:boardId/invitations')
  @ApiJsonBody('InviteToBoardInput')
  @ApiJsonResponse(201, 'InvitationList', 400, 401, 403, 404)
  async inviteToBoard(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @Body(new ZodValidationPipe(inviteToBoardSchema)) input: z.output<typeof inviteToBoardSchema>,
  ): Promise<InvitationList> {
    const scope = await this.invitations.boardScope(user.id, boardId);
    return { items: await this.invitations.inviteByEmail(user, scope, input.emails, input.role) };
  }

  @Post('boards/:boardId/invitation-link')
  @ApiJsonBody('BoardInvitationLinkInput')
  @ApiJsonResponse(201, 'Invitation', 400, 401, 403, 404)
  async boardLink(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @Body(new ZodValidationPipe(boardInvitationLinkSchema))
    input: z.output<typeof boardInvitationLinkSchema>,
  ): Promise<Invitation> {
    const scope = await this.invitations.boardScope(user.id, boardId);
    return this.invitations.createLink(user.id, scope, input.role);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(204)
  @ApiJsonResponse(204, null, 401, 403, 404)
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('invitationId', invitationIdPipe) invitationId: string,
  ): Promise<void> {
    await this.invitations.revoke(user.id, invitationId);
  }

  /** Public, so the invitation page can say what it is for before signing in. */
  @Public()
  @Get('invitations/:token')
  @ApiJsonResponse(200, 'InvitationPreview', 404)
  preview(@Param('token', tokenPipe) token: string): Promise<InvitationPreview> {
    return this.invitations.preview(token);
  }

  @Post('invitations/:token/accept')
  @HttpCode(200)
  @ApiJsonResponse(200, 'AcceptedInvitation', 401, 403, 404)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('token', tokenPipe) token: string,
  ): Promise<AcceptedInvitation> {
    return this.invitations.accept(user, token);
  }
}
