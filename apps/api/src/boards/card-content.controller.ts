import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type Checklist,
  type ChecklistItem,
  type ChecklistList,
  type Comment,
  type CommentPage,
  type CreateChecklistInput,
  type CreateChecklistItemInput,
  type CreateCommentInput,
  createChecklistItemSchema,
  createChecklistSchema,
  createCommentSchema,
  type MoveChecklistItemInput,
  moveChecklistItemSchema,
  type UpdateChecklistInput,
  type UpdateChecklistItemInput,
  type UpdateCommentInput,
  updateChecklistItemSchema,
  updateChecklistSchema,
  updateCommentSchema,
} from '@flowbit/shared';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiClientMutationId, ClientMutationId } from '../realtime/client-mutation-id.decorator.js';
import { ChecklistsService } from './checklists.service.js';
import { CommentsService } from './comments.service.js';

const cardIdPipe = new IdParamPipe('CARD_NOT_FOUND');
const checklistIdPipe = new IdParamPipe('CHECKLIST_NOT_FOUND');
const itemIdPipe = new IdParamPipe('CHECKLIST_ITEM_NOT_FOUND');
const commentIdPipe = new IdParamPipe('COMMENT_NOT_FOUND');
const cursorPipe = new ZodValidationPipe(z.uuid().optional());

@ApiTags('checklists')
@Controller()
export class ChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Get('cards/:cardId/checklists')
  @ApiJsonResponse(200, 'ChecklistList', 401, 404)
  async list(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
  ): Promise<ChecklistList> {
    return { items: await this.checklists.list(user.id, cardId) };
  }

  @Post('cards/:cardId/checklists')
  @ApiClientMutationId()
  @ApiJsonBody('CreateChecklistInput')
  @ApiJsonResponse(201, 'Checklist', 400, 401, 403, 404)
  create(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Body(new ZodValidationPipe(createChecklistSchema)) input: CreateChecklistInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Checklist> {
    return this.checklists.create(user.id, cardId, input, clientMutationId);
  }

  @Patch('checklists/:checklistId')
  @ApiClientMutationId()
  @ApiJsonBody('UpdateChecklistInput')
  @ApiJsonResponse(200, 'Checklist', 400, 401, 403, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param('checklistId', checklistIdPipe) checklistId: string,
    @Body(new ZodValidationPipe(updateChecklistSchema)) input: UpdateChecklistInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Checklist> {
    return this.checklists.update(user.id, checklistId, input, clientMutationId);
  }

  @Delete('checklists/:checklistId')
  @HttpCode(204)
  @ApiClientMutationId()
  @ApiJsonResponse(204, null, 401, 403, 404)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('checklistId', checklistIdPipe) checklistId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<void> {
    await this.checklists.remove(user.id, checklistId, clientMutationId);
  }

  @Post('checklists/:checklistId/items')
  @ApiClientMutationId()
  @ApiJsonBody('CreateChecklistItemInput')
  @ApiJsonResponse(201, 'ChecklistItem', 400, 401, 403, 404)
  createItem(
    @CurrentUser() user: AuthUser,
    @Param('checklistId', checklistIdPipe) checklistId: string,
    @Body(new ZodValidationPipe(createChecklistItemSchema)) input: CreateChecklistItemInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<ChecklistItem> {
    return this.checklists.createItem(user.id, checklistId, input, clientMutationId);
  }

  @Patch('checklist-items/:itemId')
  @ApiClientMutationId()
  @ApiJsonBody('UpdateChecklistItemInput')
  @ApiJsonResponse(200, 'ChecklistItem', 400, 401, 403, 404)
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId', itemIdPipe) itemId: string,
    @Body(new ZodValidationPipe(updateChecklistItemSchema)) input: UpdateChecklistItemInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<ChecklistItem> {
    return this.checklists.updateItem(user.id, itemId, input, clientMutationId);
  }

  @Post('checklist-items/:itemId/move')
  @HttpCode(200)
  @ApiClientMutationId()
  @ApiJsonBody('MoveChecklistItemInput')
  @ApiJsonResponse(200, 'ChecklistItem', 400, 401, 403, 404)
  moveItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId', itemIdPipe) itemId: string,
    @Body(new ZodValidationPipe(moveChecklistItemSchema)) input: MoveChecklistItemInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<ChecklistItem> {
    return this.checklists.moveItem(user.id, itemId, input, clientMutationId);
  }

  @Delete('checklist-items/:itemId')
  @HttpCode(204)
  @ApiClientMutationId()
  @ApiJsonResponse(204, null, 401, 403, 404)
  async removeItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId', itemIdPipe) itemId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<void> {
    await this.checklists.removeItem(user.id, itemId, clientMutationId);
  }
}

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('cards/:cardId/comments')
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Cursor: `nextCursor` of the previous page',
  })
  @ApiJsonResponse(200, 'CommentPage', 400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Query('before', cursorPipe) before: string | undefined,
  ): Promise<CommentPage> {
    return this.comments.list(user.id, cardId, before);
  }

  @Post('cards/:cardId/comments')
  @ApiClientMutationId()
  @ApiJsonBody('CreateCommentInput')
  @ApiJsonResponse(201, 'Comment', 400, 401, 403, 404)
  create(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) input: CreateCommentInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Comment> {
    return this.comments.create(user.id, cardId, input, clientMutationId);
  }

  @Patch('comments/:commentId')
  @ApiClientMutationId()
  @ApiJsonBody('UpdateCommentInput')
  @ApiJsonResponse(200, 'Comment', 400, 401, 403, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param('commentId', commentIdPipe) commentId: string,
    @Body(new ZodValidationPipe(updateCommentSchema)) input: UpdateCommentInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Comment> {
    return this.comments.update(user.id, commentId, input, clientMutationId);
  }

  @Delete('comments/:commentId')
  @HttpCode(204)
  @ApiClientMutationId()
  @ApiJsonResponse(204, null, 401, 403, 404)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('commentId', commentIdPipe) commentId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<void> {
    await this.comments.remove(user.id, commentId, clientMutationId);
  }
}
