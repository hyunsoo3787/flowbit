# Decision Log

This file records the foundational decisions for Flowbit, why they were made,
and what was considered instead. When a decision changes, do not edit the old
entry in place: mark it **Superseded** and add a new entry that explains why.

Status values: **Accepted**, **Proposed**, **Superseded by D-XXX**. A clarification
that keeps a decision in force is appended to its entry as a dated **Amendment**.

| ID                                                                         | Decision                                                    | Status                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| [D-001](#d-001-full-product-scope-built-in-phases)                         | Full product scope, built in phases                         | Accepted                      |
| [D-002](#d-002-support-both-self-hosting-and-saas)                         | Support both self-hosting and SaaS                          | Accepted                      |
| [D-003](#d-003-typescript-across-the-whole-stack)                          | TypeScript across the whole stack                           | Accepted                      |
| [D-004](#d-004-separate-spa-and-api-server-in-one-monorepo)                | Separate SPA and API server in one monorepo                 | Accepted                      |
| [D-005](#d-005-nestjs-for-the-api-server)                                  | NestJS for the API server                                   | Accepted                      |
| [D-006](#d-006-rest--openapi-as-the-api-style)                             | REST + OpenAPI as the API style                             | Accepted                      |
| [D-007](#d-007-postgresql-only-with-prisma)                                | PostgreSQL only, with Prisma                                | Accepted                      |
| [D-008](#d-008-organization--workspace--board-hierarchy)                   | Organization > Workspace > Board hierarchy                  | Accepted                      |
| [D-009](#d-009-authentication-methods)                                     | Authentication methods                                      | Accepted                      |
| [D-010](#d-010-real-time-sync-over-websockets)                             | Real-time sync over WebSockets                              | Accepted                      |
| [D-011](#d-011-open-core-licensing-agpl-30--commercial-ee)                 | Open-core licensing (AGPL-3.0 + commercial `ee/`)           | Accepted                      |
| [D-012](#d-012-cla-for-external-contributions)                             | CLA for external contributions                              | Accepted                      |
| [D-013](#d-013-permissive-only-dependency-policy)                          | Permissive-only dependency policy                           | Accepted (amended 2026-10-13) |
| [D-014](#d-014-frontend-stack)                                             | Frontend stack                                              | Accepted                      |
| [D-015](#d-015-fractional-indexing-for-ordering)                           | Fractional indexing for ordering                            | Accepted                      |
| [D-016](#d-016-internationalization-from-day-one-en-ko)                    | Internationalization from day one (en, ko)                  | Accepted                      |
| [D-017](#d-017-responsive-web--pwa-for-mobile)                             | Responsive web + PWA for mobile                             | Accepted                      |
| [D-018](#d-018-languages-for-code-docs-and-readme)                         | Languages for code, docs and README                         | Accepted                      |
| [D-019](#d-019-attachment-storage-local-disk-or-any-s3-compatible-service) | Attachment storage: local disk or any S3-compatible service | Accepted                      |
| [D-020](#d-020-better-auth-behind-our-own-auth-module)                     | Better Auth behind our own auth module                      | Accepted                      |
| [D-021](#d-021-instance-administrators-manage-accounts-not-content)        | Instance administrators manage accounts, not content        | Accepted                      |
| [D-022](#d-022-a-small-job-queue-on-valkey-lists)                          | A small job queue on Valkey lists                           | Accepted                      |

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
  model, an event-driven write path for real-time sync. So the _design_ covers
  the full scope even though the _implementation_ is incremental.

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

**Implementation.** Better Auth, wrapped in our own auth module. See
[D-020](#d-020-better-auth-behind-our-own-auth-module).

---

## D-010: Real-time sync over WebSockets

**Status:** Accepted

**Decision.** Changes on a board are pushed to everyone viewing it. We use
Socket.IO, with the Valkey adapter for fan-out across API replicas. The work
is split into levels:

| Level                      | What                                                       | Phase                               |
| -------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| 1. Change broadcast        | Card, list and board changes appear instantly for everyone | 2                                   |
| 2. Presence                | Who's viewing, who's editing                               | 4                                   |
| 3. Concurrent text editing | Several people typing in one description (CRDT)            | Not planned yet; revisit in phase 7 |

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

**Amendment (2026-10-13): reviewed weak-copyleft exceptions.** The first run
of the license checker found two weak-copyleft packages among the production
dependencies. Weak copyleft (e.g. MPL-2.0, EPL-2.0) applies per file: it puts
obligations on changes to those files, not on code that merely uses them.
Packages under such licenses are therefore allowed **only** if all of the
following hold:

1. They are used unmodified, as separate files, and are not copied into or
   linked as source into Flowbit's own code.
2. Their license notices are kept intact.
3. They were reviewed individually and listed, with the reason, in
   `REVIEWED_EXCEPTIONS` in `scripts/check-licenses.mjs`.

Strong copyleft (GPL, LGPL, AGPL, SSPL, etc.) and source-available licenses
remain forbidden without exception. The current exceptions are:

| Package        | License | Reason                                                                                                                                       |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `elkjs`        | EPL-2.0 | Graph layout inside Prisma Studio, shipped unmodified with the Prisma CLI that the Docker image uses to run migrations. Studio is never run. |
| `lightningcss` | MPL-2.0 | CSS build tool, reached through Vite/Vitest peer dependencies. Not used at runtime.                                                          |

---

## D-014: Frontend stack

**Status:** Accepted

**Decision.**

| Concern              | Choice                                                       |
| -------------------- | ------------------------------------------------------------ |
| Build / dev server   | Vite                                                         |
| UI library           | React                                                        |
| Routing              | TanStack Router                                              |
| Server state         | TanStack Query (patched by real-time events)                 |
| Styling / components | Tailwind CSS + shadcn/ui (Radix primitives)                  |
| Drag and drop        | dnd-kit                                                      |
| Forms / validation   | React Hook Form + Zod (schemas shared via `packages/shared`) |
| i18n                 | i18next + react-i18next                                      |
| Tests                | Vitest (unit), Playwright (end-to-end)                       |

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

---

## D-020: Better Auth behind our own auth module

**Status:** Accepted

**Decision.** Authentication is implemented with
[Better Auth](https://github.com/better-auth/better-auth) (MIT). It is wrapped
in our own NestJS auth module, so the rest of the codebase depends only on our
interfaces (the current user, the session check, and a public-route
decorator), never on Better Auth directly.

**Scope of responsibility.**

- Better Auth answers **who the user is**. It handles email + password
  sign-up and sign-in, password hashing, email verification, password reset,
  GitHub and Google OAuth with account linking, sessions, CSRF and origin
  checks, and rate limiting on auth endpoints.
- Flowbit handles **what the user may do**. Organizations, workspaces, roles
  and permission checks stay in our own models and policy code
  ([D-008](#d-008-organization--workspace--board-hierarchy)). Better Auth's
  organization plugin is **not** used.

**Integration rules.**

- Better Auth's handler is mounted directly on the Fastify instance at
  `/api/auth/*`. Our own guard resolves the session for every other route via
  `auth.api.getSession()`, and routes are protected by default. We don't use a
  community NestJS adapter: the glue code is small, and owning it keeps us
  independent of a single-maintainer package.
- Better Auth's tables (`user`, `session`, `account`, `verification`) are part
  of our Prisma schema, which stays the single source of truth for migrations.
  IDs are UUIDv7, like everywhere else.
- Sessions are stored in PostgreSQL. Valkey is used only as the rate-limit
  store, so it never holds durable state
  ([D-002](#d-002-support-both-self-hosting-and-saas)).
- After a user is created, a database hook creates their personal
  organization.
- Auth endpoints are not part of our OpenAPI spec. The web app calls them
  through Better Auth's client, and auth errors are mapped to localized
  messages in the web app.

**Why.**

- Authentication is security-critical. A maintained library handles token
  expiry, timing-safe comparisons, session fixation, CSRF and rate limiting,
  which leaves much less security-sensitive code for us to write and review.
  With Passport, all of that would be ours to build.
- It covers the whole roadmap. Everything in phase 1 is built in. Two-factor
  auth and passkeys are available as plugins, and OIDC/SAML SSO for phase 6 is
  available as `@better-auth/sso` (MIT).
- It is TypeScript-first and has an official Prisma adapter.
- It was verified as actively maintained at the time of this decision
  (`better-auth` 1.7.x, latest release in September 2026).

**Alternatives considered.**

- **Passport via `@nestjs/passport`:** mature and officially supported by
  NestJS, but it only covers the "verify this credential" step. Sessions,
  email verification, password reset, account linking and rate limiting would
  all be custom code.
- **`@thallesp/nestjs-better-auth` adapter:** convenient, but it installs a
  global guard and changes the body parser, and it depends on a single
  maintainer. We write a thin adapter ourselves instead.

**Consequences.** If Better Auth ever has to be replaced, the change is
contained in `apps/api/src/auth/` and the web app's auth client, plus a data
migration of the four auth tables.

---

## D-021: Instance administrators manage accounts, not content

**Status:** Accepted

**Decision.** Flowbit gets an **instance administrator** role: the people who
run a Flowbit server (the operator of a self-hosted install, or the SaaS
operator's staff). It is separate from the organization and workspace roles of
[D-008](#d-008-organization--workspace--board-hierarchy) and does **not** grant
access to anyone's content.

| Admin level           | Who                                      | Manages                                                             |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Workspace admin       | Workspace `ADMIN`                        | One workspace: settings, members, deletion                          |
| Organization admin    | Organization `OWNER` / `ADMIN`           | Every workspace in the organization; org UI and policies in phase 6 |
| Instance admin (this) | Users flagged as administrators globally | Accounts and server settings only                                   |

Instance administrators can:

- list and search user accounts (name, email, sign-in methods, created and last
  active dates, number of organizations and workspaces they belong to);
- suspend and reactivate accounts, which also ends their sessions;
- delete accounts;
- issue a **one-time password reset link** for a user, to hand over to that
  person directly. This is needed on installs without SMTP, where users cannot
  reset a forgotten password themselves. The administrator never chooses or
  sees the new password. Every issued link is recorded in an admin action log,
  and the user is notified by email when SMTP is configured;
- change server settings that today need an environment variable and a
  restart, starting with whether sign-up is open;
- see basic instance statistics (counts of users, organizations, workspaces).

Instance administrators **cannot** see workspace, board or card content
through this role. To see content they need an ordinary organization or
workspace membership, like anyone else. Signing in as another user
("impersonation") for support cases is deferred to phase 6 as an `ee/` feature,
and must write to the audit log.

**Who becomes an instance admin.** Only someone who can prove access to the
server itself (its logs or its shell) can create the first administrator:

1. **Setup token.** While the instance has no administrator, the server prints
   a one-time setup URL (`/setup?token=…`) to its log on startup. The operator
   opens it (for example after `docker compose logs flowbit`) and creates the
   first administrator account. The token is random, can be used only once,
   and stops working as soon as an administrator exists.
2. **Command line.** The `flowbit admin grant` and `flowbit admin revoke`
   commands take an email address and, run inside the container, add or
   remove administrators. This also recovers access if every administrator
   account is lost.
3. **`ADMIN_EMAILS` (optional).** For automated deployments, accounts whose
   email is listed are administrators, but only if email verification is
   enabled and the address has been verified. Without email verification the
   variable is ignored, and the server logs a warning at startup.
4. Administrators can grant and revoke the role for other accounts in the UI,
   but cannot revoke it from the last remaining administrator.

**Why.**

- Self-hosters need a way to manage accounts without database access: a lost
  password on an install without email, an employee who left, spam sign-ups.
- Separating account management from content access limits the damage of a
  compromised admin account, and lets a hosted service credibly promise that
  operators don't read customer data. Plane, Mattermost and similar tools draw
  the same line.
- An email address alone proves nothing on an install without email
  verification, and the first person to reach a fresh public server isn't
  necessarily its owner. Access to the server's logs or shell is something
  only the operator has. Jenkins, Sentry and GitLab use the same approach.
- Basic account management is essential for running any instance, so it
  belongs to the AGPL core, not to `ee/`
  ([D-011](#d-011-open-core-licensing-agpl-30--commercial-ee)).

**Alternatives considered.**

- **First account to sign up becomes admin** (the first draft of this
  decision): no setup at all, but on a server that is reachable before its
  owner signs up, a stranger, or a scanning bot, could claim the role.
- **Admins only via `ADMIN_EMAILS`:** explicit, but without email
  verification anyone who signs up first with a listed address becomes admin.
- **Admins set a user's new password directly** (the first draft of this
  decision): simplest, but the administrator then knows the password and can
  sign in as that user, which undermines "admins don't see content". A
  one-time link handed to the user doesn't remove that possibility entirely,
  but it is recorded, and the user notices because their old password stops
  working.
- **Instance admins can read all content:** convenient for support, but a
  single compromised account would expose every organization's data.

**Consequences.**

- The setup token is consumed atomically, so it can create at most one
  administrator even if it is used twice at the same moment.
- The self-hosting guide must explain the setup URL, the `flowbit admin`
  command, and that `ADMIN_EMAILS` requires email verification.
- The admin action log starts as a small core table. It can later feed the
  organization audit log of phase 6.
- Implemented in [phase 3](ROADMAP.md#phase-3-collaboration-basics). Better
  Auth's admin plugin was evaluated and not used: its role model is per user
  and grants itself broad session powers, while D-021 needs a narrow flag
  plus `ADMIN_EMAILS` and the setup token. The flag, suspension (a database
  hook refuses new sessions; existing ones are deleted) and reset links
  (Better Auth's own verification tokens) are a few lines in our module.
- Deleting an account deletes its personal organization, except workspaces
  that other people still use: those stay, the organization loses its
  personal owner, and one of the workspace's admins (or its oldest member,
  promoted) takes over.
- Closing sign-up doesn't lock out invited people: an address with a pending
  email invitation can still create an account.

---

## D-022: A small job queue on Valkey lists

**Status:** Accepted

**Decision.** Background jobs (notification emails now; webhooks and
automation later) and recurring tasks (due date reminders) run on a small
queue in `apps/api/src/jobs`, built on Valkey lists:

- A job is a JSON entry pushed onto a list; every replica runs a worker that
  pops entries with a blocking read.
- A failing job is retried up to five times with exponential backoff, through
  a sorted set of delayed jobs that is moved back onto the list when due.
- A recurring task runs on whichever replica takes a short Valkey lock for
  the period, so it runs once per period however many replicas there are.
- Without Valkey (a single self-hosted instance), jobs run in-process with
  the same retries. In tests they run immediately.

Jobs must be idempotent: a job can run again after a crash between doing its
work and finishing.

**Why.**

- The work is small (a handful of job types) and must also run without
  Valkey for the simplest self-hosted setup. A library built around Redis
  doesn't cover that case.
- About 150 lines that we fully understand and test against a real Valkey are
  easier to keep correct than a large dependency with its own data layout.
- Valkey is already required for multi-replica deployments
  ([D-002](#d-002-support-both-self-hosting-and-saas)), so no new service is needed.

**Alternatives considered.**

- **BullMQ:** mature, with priorities, rate limits and a dashboard. It needs
  Redis or Valkey, so the single-instance mode would need a second
  implementation anyway; and its Lua scripts and key layout are a large
  surface for a few job types. A good candidate if the job needs grow
  (phase 7 automation).
- **PostgreSQL as the queue** (`SELECT … FOR UPDATE SKIP LOCKED`, e.g.
  pg-boss): durable and transactional with the data, but adds polling load
  to the primary database, which we want to keep for user requests.

**Consequences.**

- Jobs queued only in the in-process mode are lost if the process stops
  before running them; for notification emails that is acceptable.
- Revisit when automation (phase 7) needs scheduling per user, priorities or
  visibility into failed jobs.
