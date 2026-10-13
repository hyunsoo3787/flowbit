import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { AdminService } from './admin.service.js';

/** Lets only instance administrators through. Runs after the global AuthGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly admin: AdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) throw AppError.unauthenticated();
    await this.admin.requireAdmin(request.auth.user.id);
    return true;
  }
}
