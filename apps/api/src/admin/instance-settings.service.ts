import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SIGN_UP_ENABLED = 'signUpEnabled';
const SETUP_TOKEN = 'setupToken';

/** Accounts created inside this context skip the sign-up check (the setup page). */
const signUpBypass = new AsyncLocalStorage<true>();

export function withSignUpAllowed<T>(run: () => Promise<T>): Promise<T> {
  return signUpBypass.run(true, run);
}

/**
 * Server settings that instance administrators change at runtime (D-021).
 * Environment variables give the defaults until a setting is saved.
 */
@Injectable()
export class InstanceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async signUpEnabled(): Promise<boolean> {
    const setting = await this.prisma.instanceSetting.findUnique({
      where: { key: SIGN_UP_ENABLED },
    });
    return typeof setting?.value === 'boolean' ? setting.value : !this.env.AUTH_DISABLE_SIGN_UP;
  }

  async setSignUpEnabled(enabled: boolean) {
    await this.prisma.instanceSetting.upsert({
      where: { key: SIGN_UP_ENABLED },
      create: { key: SIGN_UP_ENABLED, value: enabled },
      update: { value: enabled },
    });
  }

  /**
   * Whether a new account may be created for this email: sign-up is open, the
   * address holds a pending invitation, or the setup page is creating it.
   */
  async signUpAllowed(email: string): Promise<boolean> {
    if (signUpBypass.getStore()) return true;
    if (await this.signUpEnabled()) return true;
    const invitations = await this.prisma.invitation.count({
      where: {
        email: email.toLowerCase(),
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    return invitations > 0;
  }

  async setupToken(): Promise<string | null> {
    const setting = await this.prisma.instanceSetting.findUnique({ where: { key: SETUP_TOKEN } });
    return typeof setting?.value === 'string' ? setting.value : null;
  }

  async saveSetupToken(token: string | null) {
    if (token === null) {
      await this.prisma.instanceSetting.deleteMany({ where: { key: SETUP_TOKEN } });
      return;
    }
    await this.prisma.instanceSetting.upsert({
      where: { key: SETUP_TOKEN },
      create: { key: SETUP_TOKEN, value: token },
      update: { value: token },
    });
  }
}
