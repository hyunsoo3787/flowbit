import { Global, Inject, Module, type OnModuleInit } from '@nestjs/common';
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core';
import type { FastifyInstance } from 'fastify';
import { ENV, type Env } from '../config/env.js';
import { MailService } from '../mail/mail.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ValkeyService } from '../valkey/valkey.service.js';
import { AuthConfigController } from './auth-config.controller.js';
import { AUTH } from './auth.constants.js';
import { AuthGuard } from './auth.guard.js';
import { type Auth, createAuth } from './create-auth.js';
import { mountAuthHandler } from './mount-auth-handler.js';

@Global()
@Module({
  controllers: [AuthConfigController],
  providers: [
    {
      provide: AUTH,
      inject: [ENV, PrismaService, MailService, OrganizationsService, ValkeyService],
      useFactory: (
        env: Env,
        prisma: PrismaService,
        mail: MailService,
        organizations: OrganizationsService,
        valkey: ValkeyService,
      ) => createAuth({ env, prisma, mail, organizations, valkey }),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AUTH],
})
export class AuthModule implements OnModuleInit {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  onModuleInit() {
    const fastify = this.adapterHost.httpAdapter.getInstance<FastifyInstance>();
    mountAuthHandler(fastify, this.auth);
  }
}
