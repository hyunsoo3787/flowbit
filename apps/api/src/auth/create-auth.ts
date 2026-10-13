import {
  DEFAULT_LOCALE,
  isLocale,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@flowbit/shared';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { v7 as uuidv7 } from 'uuid';
import type { InstanceSettingsService } from '../admin/instance-settings.service.js';
import type { Env } from '../config/env.js';
import type { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import type { OrganizationsService } from '../organizations/organizations.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ValkeyService } from '../valkey/valkey.service.js';
import { localeForNewUser } from './accept-language.js';

export interface AuthDependencies {
  env: Env;
  prisma: PrismaService;
  mail: MailService;
  organizations: OrganizationsService;
  valkey: ValkeyService;
  settings: InstanceSettingsService;
}

function userLocale(user: object) {
  const locale = (user as { locale?: unknown }).locale;
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/**
 * Builds the Better Auth instance (D-020). Better Auth answers "who is this
 * user"; organizations and permissions stay in Flowbit's own code.
 */
export function createAuth({
  env,
  prisma,
  mail,
  organizations,
  valkey,
  settings,
}: AuthDependencies) {
  const socialProviders = {
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
      : {}),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {}),
  };

  return betterAuth({
    appName: 'Flowbit',
    baseURL: env.PUBLIC_URL,
    basePath: '/api/auth',
    secret: env.AUTH_SECRET,
    trustedOrigins: [env.PUBLIC_URL, ...env.TRUSTED_ORIGINS],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    advanced: {
      database: { generateId: () => uuidv7() },
      useSecureCookies: env.PUBLIC_URL.startsWith('https://'),
    },

    user: {
      additionalFields: {
        locale: { type: 'string', required: false, input: true },
        // Set only by instance administrators, never through sign-up (D-021).
        isAdmin: { type: 'boolean', required: false, input: false },
        suspendedAt: { type: 'date', required: false, input: false },
      },
    },

    emailAndPassword: {
      enabled: true,
      // Whether sign-up is open is a runtime setting, checked in the user hook below.
      requireEmailVerification: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, token }) => {
        const url = `${env.PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`;
        await mail.send(user.email, mailTemplates.resetPassword(userLocale(user), user.name, url));
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mail.send(user.email, mailTemplates.verifyEmail(userLocale(user), user.name, url));
      },
    },

    socialProviders,

    rateLimit: {
      enabled: env.AUTH_RATE_LIMIT,
      ...(valkey.enabled
        ? {
            customStorage: {
              consume: (key, rule) => valkey.consume(`rate-limit:${key}`, rule.window, rule.max),
            },
          }
        : {}),
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            // Covers email sign-up and first OAuth sign-in alike.
            if (!(await settings.signUpAllowed(user.email))) {
              throw new APIError('FORBIDDEN', {
                code: 'SIGN_UP_DISABLED',
                message: 'Sign-up is disabled on this server',
              });
            }
            return {
              data: {
                ...user,
                locale: localeForNewUser(user.locale, context?.headers?.get('accept-language')),
              },
            };
          },
          after: async (user) => {
            await organizations.ensurePersonalOrganization(user.id, user.name);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { suspendedAt: true },
            });
            if (user?.suspendedAt) {
              throw new APIError('FORBIDDEN', {
                code: 'ACCOUNT_SUSPENDED',
                message: 'This account is suspended',
              });
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
