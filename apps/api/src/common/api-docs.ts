import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { type SchemaName, schemaRef } from './openapi.js';

/** Documents a JSON request body by schema name. */
export function ApiJsonBody(name: SchemaName) {
  return ApiBody({ schema: schemaRef(name) });
}

/** Documents a successful response and the standard error responses. */
export function ApiJsonResponse(
  status: number,
  name: SchemaName | null,
  ...errorStatuses: number[]
) {
  return applyDecorators(
    ApiResponse(
      name === null
        ? { status, description: 'Success' }
        : { status, description: 'Success', schema: schemaRef(name) },
    ),
    ...errorStatuses.map((errorStatus) =>
      ApiResponse({ status: errorStatus, description: 'Error', schema: schemaRef('ApiError') }),
    ),
  );
}
