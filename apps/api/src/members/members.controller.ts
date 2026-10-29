import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type BoardMemberList,
  type SetBoardMemberInput,
  setBoardMemberSchema,
  type UpdateWorkspaceMemberInput,
  updateWorkspaceMemberSchema,
  type WorkspaceMember,
  type WorkspaceMemberList,
} from '@flowbit/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiClientMutationId, ClientMutationId } from '../realtime/client-mutation-id.decorator.js';
import { MembersService } from './members.service.js';

const workspaceIdPipe = new IdParamPipe('WORKSPACE_NOT_FOUND');
const boardIdPipe = new IdParamPipe('BOARD_NOT_FOUND');
const userIdPipe = new IdParamPipe('MEMBER_NOT_FOUND');

@ApiTags('members')
@Controller()
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('workspaces/:workspaceId/members')
  @ApiJsonResponse(200, 'WorkspaceMemberList', 401, 404)
  async listWorkspaceMembers(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
  ): Promise<WorkspaceMemberList> {
    return { items: await this.members.listWorkspaceMembers(user.id, workspaceId) };
  }

  @Patch('workspaces/:workspaceId/members/:userId')
  @ApiJsonBody('UpdateWorkspaceMemberInput')
  @ApiJsonResponse(200, 'WorkspaceMember', 400, 401, 403, 404, 409)
  updateWorkspaceMember(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
    @Param('userId', userIdPipe) memberId: string,
    @Body(new ZodValidationPipe(updateWorkspaceMemberSchema)) input: UpdateWorkspaceMemberInput,
  ): Promise<WorkspaceMember> {
    return this.members.updateWorkspaceMember(user.id, workspaceId, memberId, input.role);
  }

  @Delete('workspaces/:workspaceId/members/:userId')
  @HttpCode(204)
  @ApiJsonResponse(204, null, 401, 403, 404, 409)
  async removeWorkspaceMember(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
    @Param('userId', userIdPipe) memberId: string,
  ): Promise<void> {
    await this.members.removeWorkspaceMember(user.id, workspaceId, memberId);
  }

  @Get('boards/:boardId/members')
  @ApiJsonResponse(200, 'BoardMemberList', 401, 404)
  async listBoardMembers(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
  ): Promise<BoardMemberList> {
    return { items: await this.members.listBoardMembers(user.id, boardId) };
  }

  @Put('boards/:boardId/members/:userId')
  @ApiClientMutationId()
  @ApiJsonBody('SetBoardMemberInput')
  @ApiJsonResponse(200, 'BoardMemberList', 400, 401, 403, 404, 409)
  async setBoardMember(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @Param('userId', userIdPipe) memberId: string,
    @Body(new ZodValidationPipe(setBoardMemberSchema)) input: SetBoardMemberInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<BoardMemberList> {
    return {
      items: await this.members.setBoardMember(
        user.id,
        boardId,
        memberId,
        input.role,
        clientMutationId,
      ),
    };
  }

  @Delete('boards/:boardId/members/:userId')
  @ApiClientMutationId()
  @ApiJsonResponse(200, 'BoardMemberList', 401, 403, 404, 409)
  async removeBoardMember(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @Param('userId', userIdPipe) memberId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<BoardMemberList> {
    return {
      items: await this.members.removeBoardMember(user.id, boardId, memberId, clientMutationId),
    };
  }
}
