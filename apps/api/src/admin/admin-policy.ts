import type { Env } from '../config/env.js';

interface AdminCandidate {
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  suspendedAt: Date | null;
}

/**
 * Whether ADMIN_EMAILS makes this account an administrator (D-021): only with
 * email verification on, and only for a verified address, because otherwise
 * anyone could sign up with a listed address.
 */
export function isAdminFromConfig(
  user: Pick<AdminCandidate, 'email' | 'emailVerified'>,
  env: Pick<Env, 'ADMIN_EMAILS' | 'AUTH_REQUIRE_EMAIL_VERIFICATION'>,
): boolean {
  return (
    env.AUTH_REQUIRE_EMAIL_VERIFICATION &&
    user.emailVerified &&
    env.ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
}

/** Instance administrators manage accounts and server settings, never content. */
export function isInstanceAdmin(
  user: AdminCandidate,
  env: Pick<Env, 'ADMIN_EMAILS' | 'AUTH_REQUIRE_EMAIL_VERIFICATION'>,
): boolean {
  if (user.suspendedAt) return false;
  return user.isAdmin || isAdminFromConfig(user, env);
}
