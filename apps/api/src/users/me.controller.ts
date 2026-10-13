import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type UpdateProfileInput, updateProfileSchema, type UserProfile } from '@flowbit/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiJsonResponse(200, 'UserProfile', 401)
  get(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    return this.users.getProfile(user.id);
  }

  @Patch()
  @ApiJsonBody('UpdateProfileInput')
  @ApiJsonResponse(200, 'UserProfile', 400, 401)
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) input: UpdateProfileInput,
  ): Promise<UserProfile> {
    return this.users.updateProfile(user.id, input);
  }
}
