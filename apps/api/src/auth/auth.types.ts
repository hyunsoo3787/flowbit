import type { FastifyRequest } from 'fastify';
import type { Auth } from './create-auth.js';

export type AuthSession = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
export type AuthUser = AuthSession['user'];

export interface AuthenticatedRequest extends FastifyRequest {
  auth?: AuthSession;
}
