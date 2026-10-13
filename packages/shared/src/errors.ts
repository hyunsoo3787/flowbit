import { z } from 'zod';

/**
 * Stable, machine-readable error codes returned by the API.
 * The web client maps each code to a localized message (D-016).
 * Never rename a code once released; add a new one instead.
 */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'WORKSPACE_NOT_FOUND',
  'BOARD_NOT_FOUND',
  'LIST_NOT_FOUND',
  'CARD_NOT_FOUND',
  'LABEL_NOT_FOUND',
  'CHECKLIST_NOT_FOUND',
  'CHECKLIST_ITEM_NOT_FOUND',
  'COMMENT_NOT_FOUND',
  'USER_NOT_FOUND',
  'MEMBER_NOT_FOUND',
  'INVITATION_NOT_FOUND',
  'INVITATION_EMAIL_MISMATCH',
  /** The change would leave a workspace, board or instance without an admin. */
  'LAST_ADMIN',
  'ACCOUNT_SUSPENDED',
  'SIGN_UP_DISABLED',
  'SETUP_NOT_AVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
export const errorCodeSchema = z.enum(ERROR_CODES);

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error;
}
