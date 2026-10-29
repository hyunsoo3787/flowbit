import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthConfig, SocialProvider } from '@flowbit/shared';
import { ApiJsonResponse } from '../common/api-docs.js';
import { InstanceSettingsService } from '../admin/instance-settings.service.js';
import { ENV, type Env } from '../config/env.js';
import { Public } from './decorators.js';

@ApiTags('auth')
@Public()
@Controller('auth/config')
export class AuthConfigController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly settings: InstanceSettingsService,
  ) {}

  @Get()
  @ApiJsonResponse(200, 'AuthConfig')
  async get(): Promise<AuthConfig> {
    const socialProviders: SocialProvider[] = [];
    if (this.env.GITHUB_CLIENT_ID && this.env.GITHUB_CLIENT_SECRET) socialProviders.push('github');
    if (this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET) socialProviders.push('google');
    return {
      socialProviders,
      signUpEnabled: await this.settings.signUpEnabled(),
      emailVerificationRequired: this.env.AUTH_REQUIRE_EMAIL_VERIFICATION,
    };
  }
}
