import { Module } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { BoardAccessService } from './board-access.service.js';
import { BoardMembersService } from './board-members.service.js';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';
import { ChecklistsController, CommentsController } from './card-content.controller.js';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';
import { ChecklistsService } from './checklists.service.js';
import { CommentsService } from './comments.service.js';
import { LabelsController } from './labels.controller.js';
import { LabelsService } from './labels.service.js';
import { ListsController } from './lists.controller.js';
import { ListsService } from './lists.service.js';

@Module({
  imports: [WorkspacesModule],
  controllers: [
    BoardsController,
    ListsController,
    CardsController,
    LabelsController,
    ChecklistsController,
    CommentsController,
  ],
  providers: [
    BoardAccessService,
    BoardMembersService,
    BoardsService,
    ListsService,
    CardsService,
    LabelsService,
    ChecklistsService,
    CommentsService,
    RealtimeService,
    RealtimeGateway,
  ],
  exports: [BoardAccessService, BoardMembersService, CardsService, RealtimeService],
})
export class BoardsModule {}
