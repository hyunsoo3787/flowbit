# Decision Log

This file records the foundational decisions for Flowbit, why they were made,
and what was considered instead. When a decision changes, do not edit the old
entry in place: mark it **Superseded** and add a new entry that explains why.

Status values: **Accepted**, **Proposed**, **Superseded by D-XXX**.

| ID | Decision | Status |
|---|---|---|
| [D-001](#d-001-full-product-scope-built-in-phases) | Full product scope, built in phases | Accepted |
| [D-002](#d-002-support-both-self-hosting-and-saas) | Support both self-hosting and SaaS | Accepted |
| [D-003](#d-003-typescript-across-the-whole-stack) | TypeScript across the whole stack | Accepted |
| [D-004](#d-004-separate-spa-and-api-server-in-one-monorepo) | Separate SPA and API server in one monorepo | Accepted |
| [D-005](#d-005-nestjs-for-the-api-server) | NestJS for the API server | Accepted |
| [D-006](#d-006-rest--openapi-as-the-api-style) | REST + OpenAPI as the API style | Accepted |
| [D-007](#d-007-postgresql-only-with-prisma) | PostgreSQL only, with Prisma | Accepted |
| [D-008](#d-008-organization--workspace--board-hierarchy) | Organization > Workspace > Board hierarchy | Accepted |
| [D-009](#d-009-authentication-methods) | Authentication methods | Accepted |
| [D-010](#d-010-real-time-sync-over-websockets) | Real-time sync over WebSockets | Accepted |
| [D-011](#d-011-open-core-licensing-agpl-30--commercial-ee) | Open-core licensing (AGPL-3.0 + commercial `ee/`) | Accepted |
| [D-012](#d-012-cla-for-external-contributions) | CLA for external contributions | Accepted |
| [D-013](#d-013-permissive-only-dependency-policy) | Permissive-only dependency policy | Accepted |
| [D-014](#d-014-frontend-stack) | Frontend stack | Accepted |
| [D-015](#d-015-fractional-indexing-for-ordering) | Fractional indexing for ordering | Accepted |
| [D-016](#d-016-internationalization-from-day-one-en-ko) | Internationalization from day one (en, ko) | Accepted |
| [D-017](#d-017-responsive-web--pwa-for-mobile) | Responsive web + PWA for mobile | Accepted |
| [D-018](#d-018-languages-for-code-docs-and-readme) | Languages for code, docs and README | Accepted |
| [D-019](#d-019-attachment-storage-local-disk-or-any-s3-compatible-service) | Attachment storage: local disk or any S3-compatible service | Accepted |

---

## D-001: Full product scope, built in phases

**Status:** Accepted

**Decision.** Flowbit aims at the full feature set of a Trello-class tool plus
extensions (other views, automation, integrations, AI). We design for the full
scope up front but build it in phases (see [ROADMAP.md](ROADMAP.md)), and every
phase ends with something people can use.

**Why.**
- If we build everything at once, the product stays unusable for a long time.
  We can't validate anything, and outside contributors have no way in.
- Some things are hard to add later: the tenancy hierarchy, the permission
  model, an event-driven write path for real-time sync. So the *design* covers
  the full scope even though the *implementation* is incremental.

**Alternatives considered.** A narrow MVP with no forward design, which tends
to need costly rewrites. Building the full scope in one pass.

---

## D-002: Support both self-hosting and SaaS

**Status:** Accepted

**Decision.** One codebase serves both deployment modes:
- **Self-hosted:** a single `docker compose up` brings up the app, PostgreSQL
  and Valkey. Configuration is done with environment variables.
- **SaaS:** a multi-tenant deployment of the same code, scaled horizontally.

**Why.** Self-hosting drives open-source adoption and trust. A hosted offering
is the main path to sustainability (see D-011).

**Consequences.**
- No hard dependency on any cloud vendor's proprietary service.
- The API server must be stateless, which means sessions live in the DB or
  Valkey and real-time fan-out goes through Valkey, so it can run as multiple
  replicas.
- Tenant isolation is built into the data model from the start (D-008).

---

## D-003: TypeScript across the whole stack

**Status:** Accepted

**Decision.** Both the frontend and the backend are written in TypeScript.

**Why.**
- The browser side is effectively TypeScript or JavaScript regardless of the
  backend choice. Using TS for the backend too means one language to learn,
  review and hire for.
- Domain types and validation schemas (cards, boards, permissions) can be
  shared between client and server, which removes a whole class of
  client/server mismatch bugs.
- It has the largest pool of potential contributors.
- The bottlenecks of this kind of app are the DB and the network, not CPU, so
  a faster compiled backend gives little practical gain.

**Alternatives considered.**
- **Go:** strong second choice. Single-binary deploys, great concurrency, easy
  to learn. Rejected because types can't be shared with the frontend and the
  team would work in two languages.
- **Rust (Axum + SQLx):** safe and fast, and familiar to C++ developers. But
  development is slower, compile times are long, the contributor pool is
  smaller, and the performance benefit doesn't matter for a CRUD-heavy,
  I/O-bound app.
- **Python (FastAPI/Django):** proven for web apps and already familiar to the
  maintainer. Rejected because types can't be shared, real-time concurrency
  needs more work, and deployment is heavier.

---

## D-004: Separate SPA and API server in one monorepo

**Status:** Accepted

**Decision.** The frontend is a single-page app (React + Vite) and the backend
is a standalone API server. Both live in one pnpm + Turborepo monorepo.

**Why.**
- Real-time collaboration needs long-lived WebSocket connections. A standalone
  Node server handles these naturally, while serverless or full-stack
  framework route handlers handle them poorly.
- A clean, public API boundary is required anyway for integrations and
  third-party clients (D-006).
- The two parts can be deployed and scaled separately. For simple self-hosting,
  the API server can also serve the built SPA as static files.

**Alternatives considered.** Next.js as a single full-stack app. Initial setup
is simpler, but WebSockets are awkward and the backend structure becomes tied
to the framework.

---

## D-005: NestJS for the API server

**Status:** Accepted

**Decision.** The API server uses NestJS, running on its Fastify adapter.

**Why.**
- Its opinionated structure (modules, dependency injection, guards, pipes) is
  close to Spring. That makes code review predictable and onboarding easier
  as the codebase grows.
- It has first-class support for OpenAPI generation, WebSocket gateways,
  scheduling and queues, all of which are on the roadmap.
- The Fastify adapter gives better throughput than Express without giving up
  the NestJS ecosystem.

**Alternatives considered.** Fastify or Hono directly: lighter and faster to
start with, but we would have to invent and enforce our own structure.

---

## D-006: REST + OpenAPI as the API style

**Status:** Accepted

**Decision.** A resource-oriented REST API, documented by an OpenAPI spec that
is generated from the server code. A typed frontend client is generated from
that spec.

**Why.**
- A public, documented API (like Trello's) is a product feature. It enables
  webhooks, integrations, scripts, a future native app, and third-party tools.
- Generating the client from the spec gives most of tRPC's end-to-end type
  safety without locking the API to TypeScript consumers.

**Alternatives considered.** tRPC: excellent developer experience, but not
suitable as a public API. GraphQL: flexible, but more complex for both
implementers and consumers.

**Conventions** (to be detailed in phase 1):
- Base path `/api/v1`, JSON bodies, cursor-based pagination.
- Errors use stable machine-readable codes, and the frontend localizes them
  (see D-016).
- Every mutation may carry a client-generated `clientMutationId`, which is
  echoed back in real-time events (see D-010).

---

## D-007: PostgreSQL only, with Prisma

**Status:** Accepted

**Decision.** PostgreSQL is the only supported database. Prisma is the ORM and
the migration tool.

**Why.**
- PostgreSQL is the standard for both self-hosted and SaaS deployments. It has
  strong transactions, JSONB, full-text search (enough for early search), and
  row-level security if we ever need it.
- Supporting a single database avoids a feature and test matrix.
- Prisma's single schema file is easy to read and review, and it generates
  typed clients and migrations.

**Alternatives considered.** Adding SQLite for ultra-light personal installs:
rejected because of the testing and feature-parity cost. Drizzle: closer to
SQL and lighter, a reasonable alternative. TypeORM / MikroORM: decorator-based
and similar to JPA, with a weaker type-safety story.

---

## D-008: Organization > Workspace > Board hierarchy

**Status:** Accepted

**Decision.** The data model has three tenancy levels from day one:
**Organization > Workspace > Board**. The Organization level is **hidden in
the UI** until enterprise features need it. Every user gets a personal
organization automatically, and the UI only shows "my workspaces".

**Why.**
- From the user's point of view this behaves exactly like a simple
  Workspace > Board model.
- Enterprise features attach naturally to an organization: SSO with domain
  verification, consolidated billing across several workspaces, central member
  offboarding, audit logs, and security policies.
- Adding a tenancy level to a live database later means a painful data
  migration. Trello itself bolted on an Enterprise layer after the fact.

**Alternatives considered.** Workspace > Board only, with organizations added
later through a migration. Rejected because SSO and SaaS are both committed
goals.

**Consequences.** Every tenant-owned row can be resolved to exactly one
organization. Authorization and data-isolation checks are written against this
chain. See [ARCHITECTURE.md](ARCHITECTURE.md#authorization).

---

## D-009: Authentication methods

**Status:** Accepted

**Decision.** Supported sign-in methods:
1. Email + password (required for self-hosting). Phase 1.
2. OAuth with GitHub and Google. Phase 1.
3. SSO with OIDC and SAML, configured per organization. Phase 6, in `ee/`.

**Open point.** Whether to use an auth library (e.g. Better Auth, MIT) or
build on Passport strategies inside NestJS will be decided at the start of
phase 1 and recorded as a new entry.

---

## D-010: Real-time sync over WebSockets

**Status:** Accepted

**Decision.** Changes on a board are pushed to everyone viewing it. We use
Socket.IO, with the Valkey adapter for fan-out across API replicas. The work
is split into levels:

| Level | What | Phase |
|---|---|---|
| 1. Change broadcast | Card, list and board changes appear instantly for everyone | 2 |
| 2. Presence | Who's viewing, who's editing | 4 |
| 3. Concurrent text editing | Several people typing in one description (CRDT) | Not planned yet; revisit in phase 7 |

**Why.**
- Collaboration is the core of the product. Building the write path as
  "commit, then publish a domain event" from phase 2 means real-time is never
  bolted on later.
- Level 3 is not something Trello offers and needs a CRDT. We defer it.

**Alternatives considered.** Deferring all real-time work to phase 4 would
make early phases faster, but the API and client state handling would then
need rework.

---

## D-011: Open-core licensing (AGPL-3.0 + commercial `ee/`)

**Status:** Accepted

**Decision.**
- Everything outside `ee/` is licensed under **AGPL-3.0**.
- Code under `ee/` (enterprise features such as SSO/SAML, audit logs and
  advanced admin) is under a **commercial license**. It is source-visible, but
  using it in production requires a license key.
- The maintainers may also sell commercial licenses of the core to companies
  that cannot accept the AGPL (dual licensing).

**Why.**
- The AGPL keeps the product open and stops a competitor from running a
  closed, modified hosted version without sharing their changes.
- Open core plus dual licensing is a proven model (GitLab, Mattermost,
  Cal.com, Plane). It funds development while self-hosters keep a fully
  functional core.

**Alternatives considered.** MIT or Apache-2.0: maximum adoption but no
commercial protection. FSL or BSL: protection, but they are source-available
rather than OSI open source.

**Consequences.**
- Core code must never import from `ee/`. `ee/` plugs into the core through
  defined extension points (see [ARCHITECTURE.md](ARCHITECTURE.md#open-core-boundary)).
- D-012 and D-013 follow from this decision.
- The exact license texts should get legal review before the first public
  release.

---

## D-012: CLA for external contributions

**Status:** Accepted

**Decision.** External contributors sign a Contributor License Agreement. A
bot (e.g. CLA Assistant) collects signatures on each pull request.

**Why.** Dual licensing (D-011) requires the right to relicense contributed
code commercially. A DCO alone only certifies origin and doesn't grant that
right.

---

## D-013: Permissive-only dependency policy

**Status:** Accepted

**Decision.** Runtime and bundled dependencies must use permissive licenses:
MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, CC0, the PostgreSQL License, or
similar. Copyleft licenses (GPL, LGPL, AGPL, SSPL, etc.) and source-available
licenses (RSAL, BSL, etc.) are not allowed. CI runs a license checker that
fails the build on violations.

**Why.** Code we sell under a commercial license (D-011) can't contain
copyleft or restricted third-party code.

**Consequences.**
- **Valkey** (BSD-3-Clause) is used instead of Redis, because Redis 7.4 and
  later are no longer under a permissive license. Valkey is protocol-compatible.
- **MinIO** (AGPL) is not bundled. See D-019.
- New dependencies are checked for their license during review.

---

## D-014: Frontend stack

**Status:** Accepted

**Decision.**

| Concern | Choice |
|---|---|
| Build / dev server | Vite |
| UI library | React |
| Routing | TanStack Router |
| Server state | TanStack Query (patched by real-time events) |
| Styling / components | Tailwind CSS + shadcn/ui (Radix primitives) |
| Drag and drop | dnd-kit |
| Forms / validation | React Hook Form + Zod (schemas shared via `packages/shared`) |
| i18n | i18next + react-i18next |
| Tests | Vitest (unit), Playwright (end-to-end) |

**Why.** These are widely used, well documented and permissively licensed.
shadcn/ui copies component source into the repo, so we own and can theme it.
dnd-kit supports keyboard and touch drag and drop, which we need for
accessibility and mobile.

---

## D-015: Fractional indexing for ordering

**Status:** Accepted

**Decision.** The order of lists, cards, checklist items and similar entities
is stored as a fractional-index string in `position`. To move an item, we
generate a key between its new neighbours.

**Why.** A move then updates exactly one row. That keeps writes cheap, avoids
renumbering whole lists, and greatly reduces conflicts when people reorder at
the same time.

**Consequences.** Keys can grow after many inserts at the same spot, so an
occasional per-list rebalance job may be needed.

---

## D-016: Internationalization from day one (en, ko)

**Status:** Accepted

**Decision.** The UI ships with English and Korean from phase 1. No
user-facing string is hard-coded. The API returns error codes, and the client
translates them. Emails and notifications are localized using the user's
locale.

**Why.** Retrofitting i18n means touching every screen. Doing it from the
start costs little.

---

## D-017: Responsive web + PWA for mobile

**Status:** Accepted

**Decision.** Mobile is served by a responsive web app that can be installed
as a PWA. A native app is not planned for now. Because the REST API is public,
one could be added later (e.g. with React Native).

---

## D-018: Languages for code, docs and README

**Status:** Accepted

**Decision.** Code, comments, commit messages, issues and docs are written in
English. The README is provided in English (`README.md`) and Korean
(`README.ko.md`).

**Why.** English makes the project accessible to a global contributor base,
and the Korean README serves the initial local community.

---

## D-019: Attachment storage: local disk or any S3-compatible service

**Status:** Accepted

**Decision.** Attachments are stored through a storage abstraction with two
drivers: local disk (the default for self-hosting) and any S3-compatible
service (AWS S3, Cloudflare R2, etc.). We don't bundle an object-storage
server in our Compose setup.

**Why.** This keeps the default install simple and avoids bundling AGPL
software (MinIO) in our distribution (D-013). Self-hosters can still point the
S3 driver at any compatible service they run themselves.
