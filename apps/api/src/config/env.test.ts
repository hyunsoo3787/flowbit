import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const base = {
  PUBLIC_URL: 'https://flowbit.example.com/',
  DATABASE_URL: 'postgresql://localhost/flowbit',
  AUTH_SECRET: 'x'.repeat(32),
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.PUBLIC_URL).toBe('https://flowbit.example.com');
    expect(env.TRUSTED_ORIGINS).toEqual([]);
    expect(env.AUTH_REQUIRE_EMAIL_VERIFICATION).toBe(false);
    expect(env.AUTH_RATE_LIMIT).toBe(false);
  });

  it('requires email verification by default when SMTP is configured', () => {
    expect(
      parseEnv({ ...base, SMTP_URL: 'smtp://localhost' }).AUTH_REQUIRE_EMAIL_VERIFICATION,
    ).toBe(true);
    expect(
      parseEnv({ ...base, SMTP_URL: 'smtp://localhost', AUTH_REQUIRE_EMAIL_VERIFICATION: 'false' })
        .AUTH_REQUIRE_EMAIL_VERIFICATION,
    ).toBe(false);
  });

  it('treats empty variables as unset', () => {
    const env = parseEnv({ ...base, PORT: '', SMTP_URL: '', AUTH_REQUIRE_EMAIL_VERIFICATION: '' });
    expect(env.PORT).toBe(3000);
    expect(env.SMTP_URL).toBeUndefined();
    expect(env.AUTH_REQUIRE_EMAIL_VERIFICATION).toBe(false);
  });

  it('enables auth rate limiting in production', () => {
    expect(parseEnv({ ...base, NODE_ENV: 'production' }).AUTH_RATE_LIMIT).toBe(true);
  });

  it('reports every invalid variable', () => {
    expect(() => parseEnv({ PUBLIC_URL: 'not a url', AUTH_SECRET: 'short' })).toThrow(
      /PUBLIC_URL[\s\S]*DATABASE_URL[\s\S]*AUTH_SECRET/,
    );
  });
});
