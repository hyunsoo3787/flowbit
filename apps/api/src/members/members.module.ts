import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';

@Module({
  imports: [WorkspacesModule, BoardsModule],
  controllers: [MembersController, InvitationsController],
  providers: [MembersService, InvitationsService],
  exports: [InvitationsService],
})
export class MembersModule {}
