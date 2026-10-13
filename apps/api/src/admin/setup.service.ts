import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DEFAULT_LOCALE, type CompleteSetupInput } from '@flowbit/shared';
import { AUTH } from '../auth/auth.constants.js';
import type { Auth } from '../auth/create-auth.js';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminService } from './admin.service.js';
import { InstanceSettingsService, withSignUpAllowed } from './instance-settings.service.js';

/**
 * Creating the first instance administrator (D-021). While there is none, the
 * server keeps a one-time setup token and prints the setup URL to its log at
 * startup, so only someone with access to the server can claim the role.
 */
@Injectable()
export class SetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
    private readonly settings: InstanceSettingsService,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (this.env.NODE_ENV === 'test') return;
    // In the background: startup must not wait for, or fail on, this check.
    this.announce().catch((error: unknown) =>
      this.logger.warn(`Could not check for an instance administrator: ${String(error)}`),
    );
  }

  private async announce() {
    const token = await this.ensureToken();
    if (token) {
      this.logger.warn(
        `No instance administrator yet. Open this one-time link to create one:\n\n    ${this.env.PUBLIC_URL}/setup?token=${token}\n`,
      );
    }
    if (this.env.ADMIN_EMAILS.length > 0 && !this.env.AUTH_REQUIRE_EMAIL_VERIFICATION) {
      this.logger.warn('ADMIN_EMAILS is ignored because email verification is off (see D-021).');
    }
  }

  /** Whether the instance still needs its first administrator. */
  async required(): Promise<boolean> {
    return (await this.admin.countAdmins()) === 0;
  }

  /** The current setup token, creating one if needed; null once an admin exists. */
  async ensureToken(): Promise<string | null> {
    if (!(await this.required())) {
      await this.settings.saveSetupToken(null);
      return null;
    }
    const existing = await this.settings.setupToken();
    if (existing) return existing;
    const token = randomBytes(24).toString('base64url');
    await this.settings.saveSetupToken(token);
    return token;
  }

  /**
   * Makes the signed-in caller, or a new account, the first administrator.
   * Returns the new account's id when one was created, so the caller can be
   * signed in.
   */
  async complete(callerId: string | null, input: CompleteSetupInput): Promise<string> {
    const expected = await this.settings.setupToken();
    if (!(await this.required()) || !expected || !sameToken(expected, input.token)) {
      throw AppError.notFound('SETUP_NOT_AVAILABLE');
    }

    let userId = callerId;
    if (!userId) {
      if (!input.account) throw AppError.badRequest('VALIDATION_FAILED', 'account is required');
      userId = await this.createAccount(input.account);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { isAdmin: true } });
      await this.admin.log(tx, null, userId, 'admin.granted', { via: 'setup' });
    });
    await this.settings.saveSetupToken(null);
    return userId;
  }

  /** An administrator proved access to the server, so their address counts as verified. */
  private async createAccount(account: NonNullable<CompleteSetupInput['account']>) {
    const email = account.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw AppError.conflict(
        'CONFLICT',
        'An account with this email already exists; sign in first',
      );
    }
    const result = await withSignUpAllowed(() =>
      this.auth.api.signUpEmail({
        body: { name: account.name, email, password: account.password, locale: DEFAULT_LOCALE },
      }),
    );
    await this.prisma.user.update({ where: { id: result.user.id }, data: { emailVerified: true } });
    return result.user.id;
  }
}

function sameToken(expected: string, given: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
