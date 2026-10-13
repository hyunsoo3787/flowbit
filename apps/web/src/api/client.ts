import { type ApiErrorBody, type ErrorCode, isApiErrorBody } from '@flowbit/shared';
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

/** An error returned by the Flowbit API, carrying its stable error code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const throwOnError: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return undefined;
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined);
    if (isApiErrorBody(body)) {
      const { code, message, details } = (body as ApiErrorBody).error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', response.statusText);
  },
};

/** Typed client for the REST API, generated from apps/api/openapi.json (D-006). */
export const api = createClient<paths>({ baseUrl: '/', credentials: 'same-origin' });
api.use(throwOnError);

/** Unwraps an openapi-fetch result whose errors were already thrown by the middleware. */
export async function unwrap<T>(promise: Promise<{ data?: T }>): Promise<T> {
  const { data } = await promise;
  return data as T;
}
