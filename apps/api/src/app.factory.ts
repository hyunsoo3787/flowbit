import 'reflect-metadata';
import type { LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { createOpenApiDocument } from './common/openapi.js';
import { ENV, type Env } from './config/env.js';
import { serveWebApp } from './web/serve-web-app.js';

const LOG_LEVELS: Record<Env['LOG_LEVEL'], LogLevel[]> = {
  fatal: ['fatal'],
  error: ['fatal', 'error'],
  warn: ['fatal', 'error', 'warn'],
  info: ['fatal', 'error', 'warn', 'log'],
  debug: ['fatal', 'error', 'warn', 'log', 'debug'],
  trace: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'],
};

export interface CreateAppOptions {
  logger?: LogLevel[] | false;
}

/** Creates and initializes the application without listening on a port. */
export async function createApp(options: CreateAppOptions = {}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: options.logger ?? LOG_LEVELS[(process.env['LOG_LEVEL'] as Env['LOG_LEVEL']) ?? 'info'],
  });
  const env = app.get<Env>(ENV);

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  SwaggerModule.setup('api/docs', app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: 'api/openapi.json',
    yamlDocumentUrl: 'api/openapi.yaml',
  });

  if (env.WEB_DIST_DIR) await serveWebApp(app, env.WEB_DIST_DIR);

  await app.init();
  return app;
}
