import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BoardsModule } from './boards/boards.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { ConfigModule } from './config/config.module.js';
import { EventsModule } from './events/domain-events.js';
import { HealthController } from './health/health.controller.js';
import { JobsModule } from './jobs/jobs.service.js';
import { MailModule } from './mail/mail.module.js';
import { MembersModule } from './members/members.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { ValkeyModule } from './valkey/valkey.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ValkeyModule,
    EventsModule,
    JobsModule,
    MailModule,
    OrganizationsModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    BoardsModule,
    MembersModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
