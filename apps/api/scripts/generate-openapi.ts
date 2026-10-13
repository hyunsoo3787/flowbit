// Writes the OpenAPI document to apps/api/openapi.json without starting a server.
// The web client's types are generated from that file (`pnpm --filter @flowbit/web gen:api`).
import { writeFileSync } from 'node:fs';

// Generating the document needs a valid configuration but never connects anywhere.
process.env['PUBLIC_URL'] ??= 'http://localhost:3000';
process.env['AUTH_SECRET'] ??= 'openapi-generation-only-secret-0000000000';
process.env['DATABASE_URL'] ??= 'postgresql://localhost:5432/unused';
delete process.env['VALKEY_URL'];
delete process.env['WEB_DIST_DIR'];

const { createApp } = await import('../src/app.factory.js');
const { createOpenApiDocument } = await import('../src/common/openapi.js');

const app = await createApp({ logger: false });
const document = createOpenApiDocument(app);
await app.close();

const output = new URL('../../openapi.json', import.meta.url);
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${output.pathname}`);
