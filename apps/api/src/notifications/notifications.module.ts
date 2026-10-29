import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { WatchesActivityService } from './watches-activity.service.js';

@Module({
  imports: [BoardsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, WatchesActivityService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
