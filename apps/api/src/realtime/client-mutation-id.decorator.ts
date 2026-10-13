import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { CLIENT_MUTATION_ID_HEADER } from '@flowbit/shared';
import type { FastifyRequest } from 'fastify';

const MAX_LENGTH = 100;

/**
 * The client-generated id of this mutation (D-010), echoed in the resulting
 * real-time events so the sender can ignore its own changes. Null if absent.
 */
export const ClientMutationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const value = context.switchToHttp().getRequest<FastifyRequest>().headers[
      CLIENT_MUTATION_ID_HEADER
    ];
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_LENGTH
      ? value
      : null;
  },
);

/** Documents the optional mutation id header in OpenAPI. */
export const ApiClientMutationId = () =>
  ApiHeader({
    name: CLIENT_MUTATION_ID_HEADER,
    required: false,
    description: 'Client-generated id echoed in the real-time events caused by this request.',
  });
