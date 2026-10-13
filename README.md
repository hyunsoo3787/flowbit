# Flowbit

**English** | [한국어](README.ko.md)

Flowbit is an open-source, Trello-style work management tool: boards, lists
and cards with real-time collaboration. You can self-host it or run it as a
service.

> **Status: early development.** Phases [1](docs/ROADMAP.md#phase-1-foundation)
> to [3](docs/ROADMAP.md#phase-3-collaboration-basics) are done: accounts (email +
> password, GitHub, Google), workspaces, boards with lists and cards, drag and
> drop, live updates for everyone on a board, invitations and roles, labels,
> due dates, checklists, comments with @mentions, board filters, server
> administration, an English and Korean UI, and a one-command Docker setup.
> Presence, notifications and activity feeds come next in
> [phase 4](docs/ROADMAP.md#phase-4-presence-notifications-activity).

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

| Layer      | Choice                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Language   | TypeScript, end to end                                                   |
| Web app    | React, Vite, TanStack Router and Query, Tailwind CSS, shadcn/ui, dnd-kit |
| API server | NestJS (Fastify), REST + OpenAPI                                         |
| Real-time  | Socket.IO + Valkey                                                       |
| Database   | PostgreSQL + Prisma                                                      |
| Monorepo   | pnpm + Turborepo                                                         |
| Testing    | Vitest, Playwright                                                       |

## Quick start

Run Flowbit with Docker Compose:

```sh
git clone https://github.com/hyunsoo3787/flowbit.git && cd flowbit
cp .env.example .env    # set AUTH_SECRET (openssl rand -base64 32)
docker compose up -d
```

Then open <http://localhost:3000>. See the
[self-hosting guide](docs/SELF_HOSTING.md) for email, OAuth, HTTPS and backups.

To work on Flowbit itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- [Roadmap](docs/ROADMAP.md): the phased plan from foundation to extensions
- [Architecture](docs/ARCHITECTURE.md): system design, data model,
  authorization, real-time sync, deployment
- [Decision log](docs/DECISIONS.md): what was decided, why, and what else was
  considered
- [Self-hosting](docs/SELF_HOSTING.md): configuration, upgrades and backups
- [Contributing](CONTRIBUTING.md): development setup and conventions

## License

Flowbit follows an **open-core** model
([D-011](docs/DECISIONS.md#d-011-open-core-licensing-agpl-30--commercial-ee)):

- Everything outside the `ee/` directory is licensed under the
  [**GNU AGPL-3.0**](LICENSE).
- Enterprise features in `ee/` are under a separate
  [**commercial license**](ee/LICENSE).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) to get
started. External contributors will sign a
[Contributor License Agreement](CLA.md) once
([D-012](docs/DECISIONS.md#d-012-cla-for-external-contributions)); it is still a
draft, so please open an issue before starting work on a contribution. Please
follow our [Code of Conduct](CODE_OF_CONDUCT.md), and report security issues as
described in [SECURITY.md](SECURITY.md).
