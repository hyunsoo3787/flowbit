import { Module } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { BoardAccessService } from './board-access.service.js';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';
import { ListsController } from './lists.controller.js';
import { ListsService } from './lists.service.js';

@Module({
  imports: [WorkspacesModule],
  controllers: [BoardsController, ListsController, CardsController],
  providers: [
    BoardAccessService,
    BoardsService,
    ListsService,
    CardsService,
    RealtimeService,
    RealtimeGateway,
  ],
})
export class BoardsModule {}
