import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    /** The URL users open in their browser. Used for auth callbacks and email links. */
    PUBLIC_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
    /** Extra origins allowed to call the auth API (comma-separated), e.g. a dev server. */
    TRUSTED_ORIGINS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),

    DATABASE_URL: z.string().min(1),
    VALKEY_URL: z.string().optional(),

    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
    /** Defaults to true when SMTP is configured, false otherwise. */
    AUTH_REQUIRE_EMAIL_VERIFICATION: booleanString.optional(),
    AUTH_DISABLE_SIGN_UP: booleanString.default(false),
    /** Defaults to true in production. */
    AUTH_RATE_LIMIT: booleanString.optional(),

    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    /** e.g. smtps://user:pass@smtp.example.com:465. Without it, emails are written to the log. */
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default('Flowbit <no-reply@localhost>'),

    /** Directory with the built web app. When set, the API server also serves the SPA. */
    WEB_DIST_DIR: z.string().optional(),
  })
  .transform((env) => ({
    ...env,
    AUTH_REQUIRE_EMAIL_VERIFICATION: env.AUTH_REQUIRE_EMAIL_VERIFICATION ?? Boolean(env.SMTP_URL),
    AUTH_RATE_LIMIT: env.AUTH_RATE_LIMIT ?? env.NODE_ENV === 'production',
  }));

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  // Treat empty variables as unset: Docker Compose passes `${VAR:-}` through as "".
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(defined);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
