import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type Board,
  type BoardDetail,
  type BoardList,
  createBoardSchema,
  type UpdateBoardInput,
  updateBoardSchema,
} from '@flowbit/shared';
import type { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiClientMutationId, ClientMutationId } from '../realtime/client-mutation-id.decorator.js';
import { BoardsService } from './boards.service.js';

const boardIdPipe = new IdParamPipe('BOARD_NOT_FOUND');
const workspaceIdPipe = new IdParamPipe('WORKSPACE_NOT_FOUND');

@ApiTags('boards')
@Controller()
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get('workspaces/:workspaceId/boards')
  @ApiJsonResponse(200, 'BoardList', 401, 404)
  async list(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
  ): Promise<BoardList> {
    return { items: await this.boards.listForWorkspace(user.id, workspaceId) };
  }

  @Get('me/shared-boards')
  @ApiJsonResponse(200, 'BoardList', 401)
  async listShared(@CurrentUser() user: AuthUser): Promise<BoardList> {
    return { items: await this.boards.listShared(user.id) };
  }

  @Post('workspaces/:workspaceId/boards')
  @ApiJsonBody('CreateBoardInput')
  @ApiJsonResponse(201, 'Board', 400, 401, 403, 404)
  create(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
    @Body(new ZodValidationPipe(createBoardSchema)) input: z.output<typeof createBoardSchema>,
  ): Promise<Board> {
    return this.boards.create(user.id, workspaceId, input);
  }

  @Get('boards/:boardId')
  @ApiJsonResponse(200, 'BoardDetail', 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
  ): Promise<BoardDetail> {
    return this.boards.getDetail(user.id, boardId);
  }

  @Patch('boards/:boardId')
  @ApiClientMutationId()
  @ApiJsonBody('UpdateBoardInput')
  @ApiJsonResponse(200, 'Board', 400, 401, 403, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @Body(new ZodValidationPipe(updateBoardSchema)) input: UpdateBoardInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Board> {
    return this.boards.update(user.id, boardId, input, clientMutationId);
  }

  @Delete('boards/:boardId')
  @HttpCode(204)
  @ApiClientMutationId()
  @ApiJsonResponse(204, null, 401, 403, 404)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<void> {
    await this.boards.remove(user.id, boardId, clientMutationId);
  }
}
