import type { PipeTransform } from '@nestjs/common';
import type { ErrorCode } from '@flowbit/shared';
import { z } from 'zod';
import { AppError } from './app-error.js';

const uuidSchema = z.uuid();

/**
 * Validates an ID path parameter. A malformed ID is reported as "not found",
 * exactly like an ID that doesn't exist, so the two can't be told apart.
 */
export class IdParamPipe implements PipeTransform<string, string> {
  constructor(private readonly notFoundCode: ErrorCode = 'NOT_FOUND') {}

  transform(value: string): string {
    if (!uuidSchema.safeParse(value).success) throw AppError.notFound(this.notFoundCode);
    return value;
  }
}
