import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type CreateListInput,
  createListSchema,
  type List,
  type MoveListInput,
  moveListSchema,
  type UpdateListInput,
  updateListSchema,
} from '@flowbit/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiClientMutationId, ClientMutationId } from '../realtime/client-mutation-id.decorator.js';
import { ListsService } from './lists.service.js';

const boardIdPipe = new IdParamPipe('BOARD_NOT_FOUND');
const listIdPipe = new IdParamPipe('LIST_NOT_FOUND');

@ApiTags('lists')
@Controller()
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Post('boards/:boardId/lists')
  @ApiClientMutationId()
  @ApiJsonBody('CreateListInput')
  @ApiJsonResponse(201, 'List', 400, 401, 403, 404)
  create(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @Body(new ZodValidationPipe(createListSchema)) input: CreateListInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<List> {
    return this.lists.create(user.id, boardId, input, clientMutationId);
  }

  @Patch('lists/:listId')
  @ApiClientMutationId()
  @ApiJsonBody('UpdateListInput')
  @ApiJsonResponse(200, 'List', 400, 401, 403, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param('listId', listIdPipe) listId: string,
    @Body(new ZodValidationPipe(updateListSchema)) input: UpdateListInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<List> {
    return this.lists.update(user.id, listId, input, clientMutationId);
  }

  @Post('lists/:listId/move')
  @HttpCode(200)
  @ApiClientMutationId()
  @ApiJsonBody('MoveListInput')
  @ApiJsonResponse(200, 'List', 400, 401, 403, 404)
  move(
    @CurrentUser() user: AuthUser,
    @Param('listId', listIdPipe) listId: string,
    @Body(new ZodValidationPipe(moveListSchema)) input: MoveListInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<List> {
    return this.lists.move(user.id, listId, input, clientMutationId);
  }

  @Delete('lists/:listId')
  @HttpCode(204)
  @ApiClientMutationId()
  @ApiJsonResponse(204, null, 401, 403, 404)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('listId', listIdPipe) listId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<void> {
    await this.lists.remove(user.id, listId, clientMutationId);
  }
}
