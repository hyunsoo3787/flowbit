import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type ActivityPage,
  type Notification,
  type NotificationPage,
  type NotificationPreferences,
  type UpdateNotificationPreferencesInput,
  updateNotificationPreferencesSchema,
  type WatchState,
} from '@flowbit/shared';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { NotificationsService } from './notifications.service.js';
import { WatchesActivityService } from './watches-activity.service.js';

const boardIdPipe = new IdParamPipe('BOARD_NOT_FOUND');
const cardIdPipe = new IdParamPipe('CARD_NOT_FOUND');
const notificationIdPipe = new IdParamPipe('NOTIFICATION_NOT_FOUND');
const cursorPipe = new ZodValidationPipe(z.uuid().optional());
const unreadPipe = new ZodValidationPipe(
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
);

@ApiTags('notifications')
@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly watches: WatchesActivityService,
  ) {}

  @Get('me/notifications')
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'unread', required: false, enum: ['true', 'false'] })
  @ApiJsonResponse(200, 'NotificationPage', 400, 401)
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor', cursorPipe) cursor: string | undefined,
    @Query('unread', unreadPipe) unread: boolean,
  ): Promise<NotificationPage> {
    return this.notifications.list(user.id, cursor, unread);
  }

  @Post('me/notifications/read')
  @HttpCode(204)
  @ApiJsonResponse(204, null, 401)
  async readAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.notifications.markAllRead(user.id);
  }

  @Post('me/notifications/:notificationId/read')
  @HttpCode(200)
  @ApiJsonResponse(200, 'Notification', 401, 404)
  read(
    @CurrentUser() user: AuthUser,
    @Param('notificationId', notificationIdPipe) notificationId: string,
  ): Promise<Notification> {
    return this.notifications.markRead(user.id, notificationId);
  }

  @Get('me/notification-preferences')
  @ApiJsonResponse(200, 'NotificationPreferences', 401)
  preferences(@CurrentUser() user: AuthUser): Promise<NotificationPreferences> {
    return this.notifications.preferences(user.id);
  }

  @Patch('me/notification-preferences')
  @ApiJsonBody('UpdateNotificationPreferencesInput')
  @ApiJsonResponse(200, 'NotificationPreferences', 400, 401)
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateNotificationPreferencesSchema))
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    return this.notifications.updatePreferences(user.id, input);
  }

  @Put('boards/:boardId/watch')
  @ApiJsonResponse(200, 'WatchState', 401, 404)
  watchBoard(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
  ): Promise<WatchState> {
    return this.watches.watchBoard(user.id, boardId, true);
  }

  @Delete('boards/:boardId/watch')
  @ApiJsonResponse(200, 'WatchState', 401, 404)
  unwatchBoard(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
  ): Promise<WatchState> {
    return this.watches.watchBoard(user.id, boardId, false);
  }

  @Put('cards/:cardId/watch')
  @ApiJsonResponse(200, 'WatchState', 401, 404)
  watchCard(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
  ): Promise<WatchState> {
    return this.watches.watchCard(user.id, cardId, true);
  }

  @Delete('cards/:cardId/watch')
  @ApiJsonResponse(200, 'WatchState', 401, 404)
  unwatchCard(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
  ): Promise<WatchState> {
    return this.watches.watchCard(user.id, cardId, false);
  }

  @Get('boards/:boardId/activity')
  @ApiQuery({ name: 'cursor', required: false })
  @ApiJsonResponse(200, 'ActivityPage', 400, 401, 404)
  boardActivity(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @Query('cursor', cursorPipe) cursor: string | undefined,
  ): Promise<ActivityPage> {
    return this.watches.boardActivity(user.id, boardId, cursor);
  }

  @Get('cards/:cardId/activity')
  @ApiQuery({ name: 'cursor', required: false })
  @ApiJsonResponse(200, 'ActivityPage', 400, 401, 404)
  cardActivity(
    @CurrentUser() user: AuthUser,
    @Param('cardId', cardIdPipe) cardId: string,
    @Query('cursor', cursorPipe) cursor: string | undefined,
  ): Promise<ActivityPage> {
    return this.watches.cardActivity(user.id, cardId, cursor);
  }
}
