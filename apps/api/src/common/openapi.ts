import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import {
  createWorkspaceSchema,
  ERROR_CODES,
  healthSchema,
  updateProfileSchema,
  updateWorkspaceSchema,
  userProfileSchema,
  workspaceListSchema,
  workspaceSchema,
} from '@flowbit/shared';
import { z } from 'zod';

/**
 * Named schemas exposed in the OpenAPI document. The Zod schemas in
 * `@flowbit/shared` are the single source of truth; the web client's types are
 * generated from the resulting document.
 */
const inputSchemas = {
  CreateWorkspaceInput: createWorkspaceSchema,
  UpdateWorkspaceInput: updateWorkspaceSchema,
  UpdateProfileInput: updateProfileSchema,
} satisfies Record<string, z.ZodType>;

const outputSchemas = {
  ApiError: z.object({
    error: z.object({
      code: z.enum(ERROR_CODES),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  }),
  Health: healthSchema,
  UserProfile: userProfileSchema,
  Workspace: workspaceSchema,
  WorkspaceList: workspaceListSchema,
} satisfies Record<string, z.ZodType>;

export type SchemaName = keyof typeof inputSchemas | keyof typeof outputSchemas;

/** A `$ref` to a named schema, for use in `@ApiBody` / `@ApiResponse`. */
export function schemaRef(name: SchemaName) {
  return { $ref: `#/components/schemas/${name}` };
}

function toOpenApiSchema(schema: z.ZodType, io: 'input' | 'output') {
  // OpenAPI 3.0 has no `$schema` keyword.
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { target: 'openapi-3.0', io });
  return json;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Flowbit API')
    .setDescription(
      'REST API of Flowbit. Authentication endpoints live under `/api/auth/*` and are provided by Better Auth.',
    )
    .setVersion('1')
    .addCookieAuth('better-auth.session_token')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const schemas: Record<string, unknown> = { ...document.components?.schemas };
  for (const [name, schema] of Object.entries(inputSchemas)) {
    schemas[name] = toOpenApiSchema(schema, 'input');
  }
  for (const [name, schema] of Object.entries(outputSchemas)) {
    schemas[name] = toOpenApiSchema(schema, 'output');
  }
  document.components = { ...document.components, schemas: schemas as never };
  return document;
}
