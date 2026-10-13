# Flowbit

**English** | [한국어](README.ko.md)

Flowbit is an open-source, Trello-style work management tool: boards, lists
and cards with real-time collaboration. You can self-host it or run it as a
service.

> **Status: planning.** No code yet. The project's foundational decisions,
> architecture and roadmap are documented. Implementation starts with
> [Phase 1](docs/ROADMAP.md#phase-1-foundation).

## Goals

- **Trello-class core:** boards, lists and cards with drag and drop, members,
  labels, due dates, checklists, comments, attachments and search.
- **Real-time collaboration:** everyone viewing a board sees changes
  instantly, along with who else is there.
- **Easy to self-host:** one `docker compose up` brings up the app,
  PostgreSQL and Valkey.
- **Ready for teams and companies:** organizations, SSO (OIDC/SAML), audit
  logs.
- **Beyond Trello:** table, calendar and timeline views, automation rules,
  webhooks and integrations, Trello import, and pluggable AI assistance.
- **Global from day one:** English and Korean UI, responsive web, installable
  as a PWA.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript, end to end |
| Web app | React, Vite, TanStack Router and Query, Tailwind CSS, shadcn/ui, dnd-kit |
| API server | NestJS (Fastify), REST + OpenAPI |
| Real-time | Socket.IO + Valkey |
| Database | PostgreSQL + Prisma |
| Monorepo | pnpm + Turborepo |
| Testing | Vitest, Playwright |

## Documentation

- [Roadmap](docs/ROADMAP.md): the phased plan from foundation to extensions
- [Architecture](docs/ARCHITECTURE.md): system design, data model,
  authorization, real-time sync, deployment
- [Decision log](docs/DECISIONS.md): what was decided, why, and what else was
  considered

## License

Flowbit follows an **open-core** model
([D-011](docs/DECISIONS.md#d-011-open-core-licensing-agpl-30--commercial-ee)):

- Everything outside the `ee/` directory is licensed under the
  **GNU AGPL-3.0**.
- Enterprise features in `ee/` are under a separate **commercial license**.

The license files will be added in Phase 1.

## Contributing

Contributions will be welcome once Phase 1 sets up the repository tooling.
External contributors will be asked to sign a Contributor License Agreement
([D-012](docs/DECISIONS.md#d-012-cla-for-external-contributions)).
Contribution guidelines will be published in `CONTRIBUTING.md`.
