import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type Card,
  type CreateCardInput,
  createCardSchema,
  type MoveCardInput,
  moveCardSchema,
  type UpdateCardInput,
  updateCardSchema,
} from '@flowbit/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiClientMutationId, ClientMutationId } from '../realtime/client-mutation-id.decorator.js';
import { CardsService } from './cards.service.js';

const listIdPipe = new IdParamPipe('LIST_NOT_FOUND');
const cardIdPipe = new IdParamPipe('CARD_NOT_FOUND');
const userIdPipe = new IdParamPipe('MEMBER_NOT_FOUND');
const labelIdPipe = new IdParamPipe('LABEL_NOT_FOUND');

@ApiTags('cards')
@Controller()
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Post('lists/:listId/cards')
  @ApiClientMutationId()
  @ApiJsonBody('CreateCardInput')
  @ApiJsonResponse(201, 'Card', 400, 401, 403, 404)
  create(
    @CurrentUser() user: AuthUser,
    @Param('listId', listIdPipe) listId: string,
    @Body(new ZodValidationPipe(createCardSchema)) input: CreateCardInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Card> {
    return this.cards.create(user.id, listId, input, clientMutationId);
  }

  @Get('cards/:cardId')
  @ApiJsonResponse(200, 'Card', 401, 404)
  get(@CurrentUser() user: AuthUser, @Param('cardId', cardIdPipe) cardId: string): Promise<Card> {
    return this.cards.get(user.id, cardId);
  }

  @Patch('cards/:cardId')
  @ApiClientMutationId()
  @ApiJsonBody('UpdateCardInput')
  @ApiJsonResponse(200, 'Card', 400, 401, 403, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Body(new ZodValidationPipe(updateCardSchema)) input: UpdateCardInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Card> {
    return this.cards.update(user.id, cardId, input, clientMutationId);
  }

  @Post('cards/:cardId/move')
  @HttpCode(200)
  @ApiClientMutationId()
  @ApiJsonBody('MoveCardInput')
  @ApiJsonResponse(200, 'Card', 400, 401, 403, 404)
  move(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Body(new ZodValidationPipe(moveCardSchema)) input: MoveCardInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Card> {
    return this.cards.move(user.id, cardId, input, clientMutationId);
  }

  @Delete('cards/:cardId')
  @HttpCode(204)
  @ApiClientMutationId()
  @ApiJsonResponse(204, null, 401, 403, 404)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<void> {
    await this.cards.remove(user.id, cardId, clientMutationId);
  }

  @Put('cards/:cardId/assignees/:userId')
  @ApiClientMutationId()
  @ApiJsonResponse(200, 'Card', 401, 403, 404)
  assign(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Param('userId', userIdPipe) assigneeId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Card> {
    return this.cards.setAssignee(user.id, cardId, assigneeId, true, clientMutationId);
  }

  @Delete('cards/:cardId/assignees/:userId')
  @ApiClientMutationId()
  @ApiJsonResponse(200, 'Card', 401, 403, 404)
  unassign(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Param('userId', userIdPipe) assigneeId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Card> {
    return this.cards.setAssignee(user.id, cardId, assigneeId, false, clientMutationId);
  }

  @Put('cards/:cardId/labels/:labelId')
  @ApiClientMutationId()
  @ApiJsonResponse(200, 'Card', 401, 403, 404)
  addLabel(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Param('labelId', labelIdPipe) labelId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Card> {
    return this.cards.setLabel(user.id, cardId, labelId, true, clientMutationId);
  }

  @Delete('cards/:cardId/labels/:labelId')
  @ApiClientMutationId()
  @ApiJsonResponse(200, 'Card', 401, 403, 404)
  removeLabel(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Param('labelId', labelIdPipe) labelId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Card> {
    return this.cards.setLabel(user.id, cardId, labelId, false, clientMutationId);
  }
}
