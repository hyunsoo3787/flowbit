import fastifyStatic from '@fastify/static';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { ApiErrorBody } from '@flowbit/shared';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Serves the built web app from the API server, so a self-hosted install is a
 * single process (see docs/ARCHITECTURE.md, "Deployment"). Unknown paths fall
 * back to index.html for client-side routing; unknown `/api` paths stay JSON 404s.
 */
export async function serveWebApp(app: NestFastifyApplication, distDir: string) {
  const root = resolve(distDir);
  if (!existsSync(resolve(root, 'index.html'))) {
    throw new Error(`WEB_DIST_DIR (${root}) does not contain index.html`);
  }

  await app.register(fastifyStatic, { root, wildcard: false, index: false });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.get('/*', (request, reply) => {
    if (request.url === '/api' || request.url.startsWith('/api/')) {
      const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'Not found' } };
      return reply.status(404).send(body);
    }
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
  fastify.get('/', (_request, reply) =>
    reply.header('cache-control', 'no-cache').sendFile('index.html'),
  );
}
