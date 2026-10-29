# Notes for coding agents

Flowbit is a Trello-style work management tool: a pnpm + Turborepo monorepo with
a NestJS (Fastify) API, a React SPA and shared Zod schemas. Start with
[docs/HANDOFF.md](docs/HANDOFF.md) (current state, setup, pitfalls; in Korean),
then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/DECISIONS.md](docs/DECISIONS.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Rules

- Code, comments, commit messages and docs are in English (D-018). User-facing
  text goes through i18next with keys in both `apps/web/src/i18n/locales/en.json`
  and `ko.json`; JSX string literals fail lint.
- `packages/shared` Zod schemas are the API contract. After changing one, run
  `pnpm build`, then `pnpm --filter @flowbit/api gen:openapi` and
  `pnpm --filter @flowbit/web gen:api`, and commit the generated files; CI
  fails on drift.
- Run Prettier from the repository root only (`pnpm format`).
- Every write records an `Activity` row in the same transaction and publishes
  real-time events after commit. Authorization lives in the service layer
  (`board-policy.ts`, `workspace-policy.ts`); content the caller can't see is a
  404, not a 403.
- Runtime dependencies must have permissive licenses (D-013);
  `pnpm license:check` enforces it.
- Never install OpenSSL in the Docker runtime stage (breaks Prisma's engine).
- Don't run `prisma migrate reset`; create migrations with
  `prisma migrate dev --name …` (`--create-only` when data needs converting).

## Checks before pushing

```sh
pnpm format:check && pnpm build && pnpm lint && pnpm typecheck
TEST_VALKEY_URL=redis://localhost:6379 pnpm test
pnpm license:check
pnpm --filter @flowbit/web test:e2e   # needs `pnpm build` and the dev databases
```

Local services: `docker compose -f docker-compose.dev.yml up -d` (PostgreSQL
with `flowbit` and `flowbit_test`, Valkey).
