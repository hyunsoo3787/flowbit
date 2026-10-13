import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { IS_PUBLIC } from './auth.constants.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

/** Marks a route (or controller) as reachable without a session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Injects the signed-in user. Only valid on routes that are not `@Public()`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) throw new Error('CurrentUser used on a route without authentication');
    return request.auth.user;
  },
);
