import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@flowbit/shared';

const DEFAULT_MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to do this',
  NOT_FOUND: 'Not found',
  WORKSPACE_NOT_FOUND: 'Workspace not found',
};

/**
 * An error with a stable, client-facing error code (see packages/shared/src/errors.ts).
 * The message is for developers; the web client shows a localized text per code.
 */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    message: string = DEFAULT_MESSAGES[code] ?? code,
    readonly details?: unknown,
  ) {
    super(message, status);
  }

  static notFound(code: ErrorCode = 'NOT_FOUND', message?: string) {
    return new AppError(code, HttpStatus.NOT_FOUND, message);
  }

  static forbidden(message?: string) {
    return new AppError('FORBIDDEN', HttpStatus.FORBIDDEN, message);
  }

  static unauthenticated() {
    return new AppError('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
  }
}
