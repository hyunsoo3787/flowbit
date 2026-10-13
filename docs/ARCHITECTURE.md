# Architecture

This document describes how Flowbit is structured. It is a **design draft**
written before implementation. It will be refined as each phase lands, and the
reasoning behind each choice is in [DECISIONS.md](DECISIONS.md).

## Contents

- [System overview](#system-overview)
- [Repository layout](#repository-layout)
- [Backend](#backend)
- [Frontend](#frontend)
- [Real-time sync](#real-time-sync)
- [Data model](#data-model)
- [Authorization](#authorization)
- [Multi-tenancy](#multi-tenancy)
- [Open-core boundary](#open-core-boundary)
- [Internationalization](#internationalization)
- [Deployment](#deployment)
- [Testing strategy](#testing-strategy)

---

## System overview

```mermaid
flowchart LR
    subgraph Client
        SPA["Web app (React SPA / PWA)"]
    end

    subgraph Server["API server (NestJS, N replicas)"]
        REST["REST API /api/v1"]
        WS["Socket.IO gateway"]
        JOBS["Job workers"]
    end

    PG[("PostgreSQL")]
    VK[("Valkey")]
    FS[("Attachment storage<br/>local disk or S3-compatible")]

    SPA -- "HTTPS (REST)" --> REST
    SPA <-- "WebSocket" --> WS
    REST --> PG
    REST -- "domain events" --> VK
    VK -- "pub/sub fan-out" --> WS
    JOBS --> PG
    JOBS <-- "queues" --> VK
    REST --> FS
```

- **PostgreSQL** is the single source of truth.
- **Valkey** holds no durable state. It is used for real-time pub/sub across
  replicas, job queues, rate limiting, and caching.
- The **API server** is stateless and can run as several replicas behind a
  load balancer. In a minimal self-hosted setup a single process runs the REST
  API, the WebSocket gateway and the job workers, and also serves the built
  SPA.

---

## Repository layout

Planned monorepo structure (pnpm workspaces + Turborepo):

```
flowbit/
├── apps/
│   ├── api/                 # NestJS API server (AGPL-3.0)
│   │   ├── src/
│   │   │   ├── modules/     # feature modules: auth, orgs, workspaces, boards, cards, ...
│   │   │   ├── common/      # guards, interceptors, filters, pipes
│   │   │   ├── realtime/    # Socket.IO gateway, event publishing
│   │   │   └── jobs/        # background workers and schedulers
│   │   └── prisma/          # schema.prisma, migrations, seed
│   └── web/                 # React SPA (AGPL-3.0)
│       └── src/
│           ├── routes/      # TanStack Router route tree
│           ├── features/    # feature folders: board, card, workspace, auth, ...
│           ├── components/  # shared UI (shadcn/ui based)
│           ├── api/         # generated OpenAPI client + query hooks
│           ├── realtime/    # socket client, cache patchers
│           └── i18n/        # en/, ko/ message catalogs
├── packages/
│   ├── shared/              # Zod schemas, domain types, constants, error codes
│   ├── ui/                  # (optional) shared component library
│   └── config/              # shared tsconfig, eslint, prettier presets
├── ee/                      # Enterprise features (commercial license)
│   ├── LICENSE
│   ├── api/                 # NestJS modules: sso, scim, audit, policies
│   └── web/                 # enterprise UI screens
├── docker/                  # Dockerfiles, compose files
└── docs/
```

---

## Backend

### Module structure

Each feature is a NestJS module with three layers:

- **Controller:** HTTP routes, request validation (Zod or class-validator),
  OpenAPI metadata. Contains no business logic.
- **Service:** business rules and permission checks. It runs inside a
  transaction and emits domain events.
- **Repository / Prisma access:** queries. Every query is tenant-scoped.

Cross-cutting concerns are handled by NestJS guards (authentication and
authorization), interceptors (logging, `clientMutationId` propagation) and
exception filters (mapping errors to stable error codes).

### Write path

Every mutation follows the same pattern, which is what makes real-time,
activity logs, notifications, automation and webhooks possible without
special cases:

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Controller/Service
    participant DB as PostgreSQL
    participant VK as Valkey
    participant L as Listeners

    C->>API: PATCH /api/v1/cards/:id (clientMutationId)
    API->>API: authenticate, authorize, validate
    API->>DB: BEGIN, update card, insert activity row, COMMIT
    API-->>C: 200 OK (updated card)
    API->>VK: publish CardUpdated event
    VK->>L: fan-out
    Note over L: Socket.IO broadcast (phase 2)<br/>notifications (phase 4)<br/>automation, webhooks (phase 7)
```

- The activity row is written **in the same transaction** as the change, so
  the activity log can never miss a change.
- Events are published **after commit**. If reliable delivery to external
  consumers such as webhooks becomes necessary, we will move to a
  transactional outbox (an `outbox` table plus a relay worker).

### API conventions

- Base path `/api/v1`. Resources are nested only one level where it helps,
  e.g. `/boards/:boardId/lists`.
- Cursor-based pagination: `?cursor=...&limit=...`.
- Error body: `{ "error": { "code": "BOARD_NOT_FOUND", "message": "...", "details": {} } }`.
  The `code` values are stable and defined in `packages/shared`.
- Each mutating request may include a `clientMutationId` header. It is echoed
  in the response and in the resulting real-time events.
- The OpenAPI spec is generated at build time and the web client is generated
  from it, so the spec is the contract.

---

## Frontend

- **Routing:** TanStack Router, with type-safe routes. A card detail page is
  a route (`/b/:boardId/c/:cardId`), so it can be linked and shared.
- **Server state:** TanStack Query. Query keys are scoped by entity (e.g.
  `['board', boardId]`). Real-time events update the cache in place instead
  of refetching.
- **Local UI state:** React state. A small store (e.g. Zustand) is added only
  if a real need appears.
- **Optimistic updates:** drag and drop and inline edits update the cache
  immediately and roll back if the server returns an error.
- **Components:** shadcn/ui (copied into the repo) on Radix primitives,
  styled with Tailwind, with light and dark themes and responsive layouts.
- **Drag and drop:** dnd-kit, with sensors for mouse, touch and keyboard. A
  dropped item gets a new fractional-index key between its neighbours.

---

## Real-time sync

See [D-010](DECISIONS.md#d-010-real-time-sync-over-websockets) for the levels
and the phase each one lands in.

- **Connection:** The client opens one Socket.IO connection after sign-in,
  authenticated with the same session.
- **Rooms:** When a board page opens, the client joins `board:{boardId}`. The
  server checks read access before allowing the join. User-level events
  (notifications) go to `user:{userId}`.
- **Events:** Each event has the form
  `{ type, boardId, entity, data, actorId, clientMutationId, version }`, where
  `type` is something like `card.updated`, `card.moved` or `list.created`.
- **Echo suppression:** A client ignores events that carry a
  `clientMutationId` it generated itself, because it already applied that
  change optimistically.
- **Ordering and staleness:** Every mutable entity has an integer `version`
  that increases on each update. The client drops events older than the
  version it has in cache.
- **Reconnect:** After a reconnect, the client refetches the active board to
  catch up. Event replay is not planned.
- **Scale-out:** The Socket.IO Valkey adapter delivers events to clients
  connected to any replica.

---

## Data model

This is a draft of the core entities. Field lists are indicative, and the
Prisma schema will be the source of truth. All IDs are UUIDv7 (sortable by
time). All tables have `createdAt` and `updatedAt`. Mutable domain entities
also have `version`.

```mermaid
erDiagram
    User ||--o{ AuthAccount : has
    User ||--o{ OrganizationMember : "belongs to"
    Organization ||--o{ OrganizationMember : has
    Organization ||--o{ Workspace : owns
    Workspace ||--o{ WorkspaceMember : has
    User ||--o{ WorkspaceMember : "belongs to"
    Workspace ||--o{ Board : contains
    Board ||--o{ BoardMember : has
    User ||--o{ BoardMember : "belongs to"
    Board ||--o{ List : contains
    Board ||--o{ Label : defines
    List ||--o{ Card : contains
    Card ||--o{ CardAssignee : has
    Card ||--o{ CardLabel : has
    Label ||--o{ CardLabel : "applied as"
    Card ||--o{ Checklist : has
    Checklist ||--o{ ChecklistItem : has
    Card ||--o{ Comment : has
    Card ||--o{ Attachment : has
    Board ||--o{ Activity : records
    Activity ||--o{ Notification : triggers
```

### Identity and tenancy

| Entity               | Key fields                                                                         | Notes                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `User`               | email (unique), name, avatarUrl, locale, passwordHash?, emailVerifiedAt?           | `passwordHash` is null for OAuth/SSO-only users                                                       |
| `AuthAccount`        | userId, provider (`github`, `google`, `oidc:<id>`, `saml:<id>`), providerAccountId | Links an external identity to a user                                                                  |
| `Session`            | userId, tokenHash, expiresAt, userAgent, ip                                        | Server-side sessions                                                                                  |
| `Organization`       | name, slug, isPersonal                                                             | Created automatically per user ([D-008](DECISIONS.md#d-008-organization--workspace--board-hierarchy)) |
| `OrganizationMember` | orgId, userId, role: `OWNER` \| `ADMIN` \| `MEMBER`                                |                                                                                                       |
| `Workspace`          | orgId, name, slug, description                                                     |                                                                                                       |
| `WorkspaceMember`    | workspaceId, userId, role: `ADMIN` \| `MEMBER` \| `VIEWER`                         |                                                                                                       |
| `Invitation`         | scope (workspace or board), scopeId, email?, token, role, expiresAt                | Email or link invites (phase 3)                                                                       |

### Boards and cards

| Entity          | Key fields                                                                                                                      | Notes                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Board`         | workspaceId, name, visibility: `PRIVATE` \| `WORKSPACE` \| `PUBLIC`, background, archivedAt?                                    |                                                                                                           |
| `BoardMember`   | boardId, userId, role: `ADMIN` \| `MEMBER` \| `OBSERVER`                                                                        |                                                                                                           |
| `List`          | boardId, name, position, archivedAt?                                                                                            | `position` is a fractional index ([D-015](DECISIONS.md#d-015-fractional-indexing-for-ordering))           |
| `Card`          | boardId, listId, title, description (Markdown), position, startAt?, dueAt?, dueCompletedAt?, coverId?, archivedAt?, createdById | `boardId` is denormalized for permission checks and real-time routing                                     |
| `CardAssignee`  | cardId, userId                                                                                                                  |                                                                                                           |
| `Label`         | boardId, name?, color                                                                                                           |                                                                                                           |
| `CardLabel`     | cardId, labelId                                                                                                                 |                                                                                                           |
| `Checklist`     | cardId, title, position                                                                                                         |                                                                                                           |
| `ChecklistItem` | checklistId, text, position, completedAt?, assigneeId?, dueAt?                                                                  |                                                                                                           |
| `Comment`       | cardId, authorId, body (Markdown), editedAt?, deletedAt?                                                                        |                                                                                                           |
| `Attachment`    | cardId, uploaderId, storageKey, fileName, mimeType, size                                                                        | Storage driver per [D-019](DECISIONS.md#d-019-attachment-storage-local-disk-or-any-s3-compatible-service) |
| `Watch`         | userId, boardId? or cardId?                                                                                                     | For notifications (phase 4)                                                                               |

### Activity and notifications

| Entity         | Key fields                                                  | Notes                                                      |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| `Activity`     | boardId, cardId?, actorId, type, payload (JSONB), createdAt | Append-only, written in the same transaction as the change |
| `Notification` | userId, activityId, readAt?                                 | Fan-out from activity (phase 4)                            |

### Later phases (indicative)

- Phase 6 (`ee/`): `SsoConnection`, `VerifiedDomain`, `AuditLog`,
  `OrgPolicy`, `ScimToken`, `License`.
- Phase 7: `CustomField`, `CardCustomFieldValue`, `AutomationRule`,
  `AutomationRun`, `ApiToken`, `Webhook`, `WebhookDelivery`, `AiProvider`.

---

## Authorization

Authorization is checked in the service layer on every request. It is never
trusted from the client.

**Effective board access** is resolved in this order:

1. **Org `OWNER` or `ADMIN`:** full admin access to every workspace and board
   in the organization.
2. **Explicit `BoardMember` role:** `ADMIN`, `MEMBER` or `OBSERVER`.
3. **Workspace membership**, if the board's visibility is `WORKSPACE`:
   - Workspace `ADMIN` has the same access as a board `ADMIN`.
   - Workspace `MEMBER` has the same access as a board `MEMBER`.
   - Workspace `VIEWER` has the same access as a board `OBSERVER`.
4. **`PUBLIC` board:** read-only access for anyone, including anonymous users.
5. Otherwise, no access. The API responds with `404` (not `403`), so it
   doesn't reveal that the board exists.

| Capability                                                     | Observer | Member | Admin |
| -------------------------------------------------------------- | -------- | ------ | ----- |
| View board, cards, comments                                    | ✓        | ✓      | ✓     |
| Comment                                                        | —        | ✓      | ✓     |
| Create, edit and move cards and lists                          | —        | ✓      | ✓     |
| Manage labels                                                  | —        | ✓      | ✓     |
| Manage board members and settings, archive or delete the board | —        | —      | ✓     |

The permission logic lives in one place (a policy service in `apps/api`), and
its rules are covered by unit tests.

---

## Multi-tenancy

- **Model:** One shared database and schema. Every tenant-owned row resolves
  to exactly one `Organization` through the
  `Board → Workspace → Organization` chain.
- **Isolation:** Every query in the service and repository layer is scoped by
  that chain, and permission checks run before any data is returned. Tests
  include cross-tenant access attempts. PostgreSQL row-level security can be
  added later as defense in depth.
- **Self-hosted:** The same model applies. A small team usually has a single
  organization, and the UI hides the organization level
  ([D-008](DECISIONS.md#d-008-organization--workspace--board-hierarchy)).
- **SaaS:** Plan limits and billing attach to `Organization` (phase 6).

---

## Open-core boundary

[D-011](DECISIONS.md#d-011-open-core-licensing-agpl-30--commercial-ee)
defines the license split. The technical rules are:

- Code under `apps/` and `packages/` **must not import from `ee/`**. A lint
  rule enforces this.
- `ee/` code depends on the core and plugs in through explicit extension
  points:
  - **API:** an `EnterpriseModule` is registered dynamically at startup when
    `ee/` is present and a valid license key is configured. The core exposes
    hooks for auth providers, policy checks and audit sinks.
  - **Web:** a route and slot registry lets `ee/web` add settings pages and
    UI panels.
- Without `ee/`, or without a license key, the core runs fully featured for
  everything in phases 1–5 and the core parts of phase 7.

---

## Internationalization

- **Web:** i18next with namespaced JSON catalogs in `apps/web/src/i18n/{en,ko}/`.
  There are no hard-coded user-facing strings, and a lint rule flags literal
  strings in JSX.
- **API:** Errors carry stable `code`s, and the web client maps them to
  localized messages. Server-generated text such as emails and notification
  bodies is rendered in the recipient's `User.locale`.
- **Formatting:** Dates, times and numbers use `Intl` with the user's locale
  and time zone. Due dates are stored in UTC.

---

## Deployment

### Self-hosted (Docker Compose)

```
services:
  flowbit     # API server + built SPA + workers (one image)
  postgres    # PostgreSQL
  valkey      # Valkey
```

- All configuration goes through environment variables (database URL, Valkey
  URL, public URL, OAuth credentials, SMTP, storage driver, `ee/` license
  key).
- Attachments are stored on a mounted volume by default, or in an
  S3-compatible bucket if configured.
- Migrations run automatically on startup. This can be turned off for
  controlled upgrades.

### SaaS

- The same image runs with separate roles: `api`, `realtime` and `worker`
  processes, each scaled on its own.
- It uses a managed PostgreSQL and Valkey, S3-compatible object storage, and
  a CDN for the SPA's static assets.

---

## Testing strategy

| Level           | Tool                                                 | Scope                                                                                           |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Unit            | Vitest                                               | Domain logic, permission policy, fractional indexing, shared schemas                            |
| API integration | Vitest + real PostgreSQL (Testcontainers or Compose) | Endpoints, transactions, tenant isolation                                                       |
| Real-time       | Vitest + Socket.IO client                            | Room authorization, event delivery, echo suppression                                            |
| End-to-end      | Playwright                                           | Critical user flows in Chromium (multi-browser later), including two-client real-time scenarios |
| License         | License checker in CI                                | [D-013](DECISIONS.md#d-013-permissive-only-dependency-policy)                                   |
