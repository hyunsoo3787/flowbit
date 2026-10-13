import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the real environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
