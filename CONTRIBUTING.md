# Contributing to Flowbit

Thanks for your interest in Flowbit! This guide covers how to set up a
development environment, the project's conventions, and how to submit changes.

Before you start, skim [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/DECISIONS.md](docs/DECISIONS.md). They explain how the code is organized
and why. By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Contributor License Agreement

External contributors sign the [CLA](CLA.md) once, on their first pull request.
A bot will ask you to. It lets the project offer Flowbit under both the AGPL
and a commercial license ([D-012](docs/DECISIONS.md#d-012-cla-for-external-contributions)).

## Development setup

**Requirements:** Node.js 22.12+, pnpm 10 (`corepack enable` installs the
version pinned in `package.json`), and Docker for PostgreSQL and Valkey.

```sh
pnpm install

# PostgreSQL (with a flowbit_test database for tests) and Valkey
docker compose -f docker-compose.dev.yml up -d

# API configuration
cp apps/api/.env.example apps/api/.env
# then set AUTH_SECRET in apps/api/.env (openssl rand -base64 32)

# Create the database schema
pnpm --filter @flowbit/api db:migrate

# Optional: test accounts and sample boards (see below)
pnpm build && pnpm --filter @flowbit/api db:seed

# Start everything: API on :3000, web app on :5173 (proxies /api to the API)
pnpm dev
```

Open <http://localhost:5173>. Without SMTP configured, emails such as the
verification link are printed in the API's log.

API documentation is served at <http://localhost:3000/api/docs>.

### Test accounts

`pnpm --filter @flowbit/api db:seed` creates a workspace with one account per
role, so you can check permissions without inviting anyone:

| Email                | Role in the "Flowbit team" workspace |
| -------------------- | ------------------------------------ |
| `admin@flowbit.dev`  | Admin (also owns a private board)    |
| `member@flowbit.dev` | Member: can edit boards              |
| `viewer@flowbit.dev` | Viewer: read-only                    |

The password for all of them is `flowbit-dev-password`. Run the command again
with `--reset` to recreate the data. The script refuses to run when
`NODE_ENV=production`.

## Project layout

```
apps/api         NestJS API server (REST + Better Auth), Prisma schema
apps/web         React web app (Vite, TanStack Router/Query, Tailwind)
packages/shared  Zod schemas, types and constants shared by both
ee/              Enterprise features (commercial license); core must not import it
docker/          Dockerfile and Compose helpers
docs/            Architecture, decisions, roadmap, self-hosting
```

## Everyday commands

Run these from the repository root. Turborepo runs them in every package.

| Command                               | What it does                                              |
| ------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                            | Start the API and web app with reload on change           |
| `pnpm build`                          | Build all packages                                        |
| `pnpm lint`                           | ESLint                                                    |
| `pnpm typecheck`                      | TypeScript                                                |
| `pnpm test`                           | Unit tests, plus API integration tests against PostgreSQL |
| `pnpm format`                         | Format with Prettier                                      |
| `pnpm license:check`                  | Check production dependency licenses                      |
| `pnpm --filter @flowbit/web test:e2e` | Playwright end-to-end tests (after `pnpm build`)          |

API integration tests use `TEST_DATABASE_URL` (default
`postgresql://flowbit:flowbit@localhost:5432/flowbit_test`) and truncate its
tables. Set `TEST_VALKEY_URL` to also run the Valkey tests.

## Conventions

### Changing the API

1. Define or update the request and response schemas in
   `packages/shared` (Zod). They are the single source of truth.
2. Implement the endpoint in `apps/api`. Put permission checks in the service
   layer. Report anything the caller can't access as **not found**.
3. Regenerate the contract and the web client types:

   ```sh
   pnpm build
   pnpm --filter @flowbit/api gen:openapi
   pnpm --filter @flowbit/web gen:api
   ```

   Commit `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`. CI fails
   if they are out of date.

4. New error cases get a stable code in `packages/shared/src/errors.ts` and a
   message in both language files.

### Database changes

Edit `apps/api/prisma/schema.prisma`, then create a migration:

```sh
pnpm --filter @flowbit/api db:migrate --name short_description
```

Never edit a migration that has been merged; add a new one instead.

### User-facing text (i18n)

The UI ships in English and Korean
([D-016](docs/DECISIONS.md#d-016-internationalization-from-day-one-en-ko)).
Every string goes into both `apps/web/src/i18n/locales/en.json` and `ko.json`.
A lint rule rejects hard-coded text in JSX, and a test checks that both files
have the same keys. If you don't speak Korean, add your best attempt and
mention it in the pull request; a maintainer will review it.

### Dependencies

Only permissively licensed dependencies are allowed
([D-013](docs/DECISIONS.md#d-013-permissive-only-dependency-policy)). Run
`pnpm license:check` after adding one.

### Architecture decisions

Significant decisions (a new library, a new pattern, a change of direction) get
an entry in [docs/DECISIONS.md](docs/DECISIONS.md). Don't rewrite an accepted
entry; mark it superseded and add a new one.

### Commits

Use [Conventional Commits](https://www.conventionalcommits.org/), e.g.
`feat(web): add board filters`, `fix(api): reject empty workspace names`,
`docs: explain backups`. Keep the subject under about 72 characters and explain
the _why_ in the body.

## Pull requests

- Keep each pull request focused on one change. Open an issue first for larger
  changes, so we can agree on the approach.
- Add or update tests. Bug fixes should include a test that fails without the fix.
- Include screenshots for UI changes, in both light and dark mode if relevant.
- CI must be green: formatting, lint, types, tests, license check,
  generated files, end-to-end tests and the Docker build.
