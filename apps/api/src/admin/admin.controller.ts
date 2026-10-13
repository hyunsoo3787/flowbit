import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type AdminActionPage,
  type AdminUser,
  type AdminUserPage,
  type CompleteSetupInput,
  completeSetupSchema,
  type InstanceSettings,
  type InstanceStats,
  type PasswordResetLink,
  type SetupStatus,
  type UpdateInstanceSettingsInput,
  updateInstanceSettingsSchema,
} from '@flowbit/shared';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AUTH } from '../auth/auth.constants.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Auth } from '../auth/create-auth.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';
import { SetupService } from './setup.service.js';

const userIdPipe = new IdParamPipe('USER_NOT_FOUND');
const cursorPipe = new ZodValidationPipe(z.uuid().optional());
const queryPipe = new ZodValidationPipe(z.string().max(200).optional());

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiJsonResponse(200, 'InstanceStats', 401, 403)
  stats(): Promise<InstanceStats> {
    return this.admin.stats();
  }

  @Get('users')
  @ApiQuery({ name: 'query', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiJsonResponse(200, 'AdminUserPage', 400, 401, 403)
  users(
    @Query('query', queryPipe) query: string | undefined,
    @Query('cursor', cursorPipe) cursor: string | undefined,
  ): Promise<AdminUserPage> {
    return this.admin.listUsers(query, cursor);
  }

  @Post('users/:userId/suspend')
  @HttpCode(200)
  @ApiJsonResponse(200, 'AdminUser', 400, 401, 403, 404, 409)
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<AdminUser> {
    return this.admin.suspend(user.id, userId);
  }

  @Post('users/:userId/reactivate')
  @HttpCode(200)
  @ApiJsonResponse(200, 'AdminUser', 401, 403, 404)
  reactivate(
    @CurrentUser() user: AuthUser,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<AdminUser> {
    return this.admin.reactivate(user.id, userId);
  }

  @Delete('users/:userId')
  @HttpCode(204)
  @ApiJsonResponse(204, null, 400, 401, 403, 404, 409)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<void> {
    await this.admin.deleteUser(user.id, userId);
  }

  @Post('users/:userId/password-reset-link')
  @ApiJsonResponse(201, 'PasswordResetLink', 401, 403, 404)
  resetLink(
    @CurrentUser() user: AuthUser,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<PasswordResetLink> {
    return this.admin.passwordResetLink(user.id, userId);
  }

  @Put('users/:userId/admin')
  @ApiJsonResponse(200, 'AdminUser', 401, 403, 404)
  grant(
    @CurrentUser() user: AuthUser,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<AdminUser> {
    return this.admin.setAdmin(user.id, userId, true);
  }

  @Delete('users/:userId/admin')
  @ApiJsonResponse(200, 'AdminUser', 401, 403, 404, 409)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<AdminUser> {
    return this.admin.setAdmin(user.id, userId, false);
  }

  @Get('settings')
  @ApiJsonResponse(200, 'InstanceSettings', 401, 403)
  settings(): Promise<InstanceSettings> {
    return this.admin.getSettings();
  }

  @Patch('settings')
  @ApiJsonBody('UpdateInstanceSettingsInput')
  @ApiJsonResponse(200, 'InstanceSettings', 400, 401, 403)
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateInstanceSettingsSchema)) input: UpdateInstanceSettingsInput,
  ): Promise<InstanceSettings> {
    return this.admin.updateSettings(user.id, input);
  }

  @Get('actions')
  @ApiQuery({ name: 'cursor', required: false })
  @ApiJsonResponse(200, 'AdminActionPage', 400, 401, 403)
  actions(@Query('cursor', cursorPipe) cursor: string | undefined): Promise<AdminActionPage> {
    return this.admin.listActions(cursor);
  }
}

/** The one-time setup page that creates the first administrator (D-021). */
@ApiTags('admin')
@Public()
@Controller('setup')
export class SetupController {
  constructor(
    private readonly setup: SetupService,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  @Get()
  @ApiJsonResponse(200, 'SetupStatus')
  async status(): Promise<SetupStatus> {
    return { required: await this.setup.required() };
  }

  /**
   * With a session, the caller becomes the administrator; otherwise a new
   * account is created from `account` and signed in.
   */
  @Post()
  @HttpCode(200)
  @ApiJsonBody('CompleteSetupInput')
  @ApiJsonResponse(200, 'SetupStatus', 400, 404, 409)
  async complete(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body(new ZodValidationPipe(completeSetupSchema)) input: CompleteSetupInput,
  ): Promise<SetupStatus> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    await this.setup.complete(session?.user.id ?? null, input);
    if (!session && input.account) {
      const { headers } = await this.auth.api.signInEmail({
        body: { email: input.account.email.toLowerCase(), password: input.account.password },
        returnHeaders: true,
      });
      for (const cookie of headers.getSetCookie()) reply.header('set-cookie', cookie);
    }
    return { required: false };
  }
}
