# Roadmap

Flowbit is designed for its full scope up front and built in phases
([D-001](DECISIONS.md#d-001-full-product-scope-built-in-phases)). Every phase
ends with something people can use, plus an exit checklist. Phases are
sequential, but items from later phases can be picked up early if they don't
block the current one.

> **Current status:** Phase 1 (foundation) is implemented. Phase 2 (boards,
> lists and cards) is next.

| Phase                                         | Theme                                             | Edition        |
| --------------------------------------------- | ------------------------------------------------- | -------------- |
| [1](#phase-1-foundation)                      | Foundation                                        | Core           |
| [2](#phase-2-boards-lists-cards)              | Boards, lists, cards + real-time change broadcast | Core           |
| [3](#phase-3-collaboration-basics)            | Collaboration basics                              | Core           |
| [4](#phase-4-presence-notifications-activity) | Presence, notifications, activity                 | Core           |
| [5](#phase-5-attachments-search-archive)      | Attachments, search, archive                      | Core           |
| [6](#phase-6-enterprise)                      | Enterprise                                        | `ee/`          |
| [7](#phase-7-extensions)                      | Extensions                                        | Core and `ee/` |

---

## Phase 1: Foundation

**Goal:** A deployable skeleton where users can sign up and sign in, and get a
personal organization with a first workspace.

- [x] Monorepo: pnpm workspaces + Turborepo (`apps/web`, `apps/api`,
      `packages/shared`, `ee/`)
- [x] Tooling: TypeScript strict mode, ESLint, Prettier, commit conventions
- [x] CI (GitHub Actions): lint, typecheck, unit tests, build, license check
      ([D-013](DECISIONS.md#d-013-permissive-only-dependency-policy))
- [x] Local dev environment: Docker Compose with PostgreSQL and Valkey
- [x] API skeleton: NestJS (Fastify adapter), config, health check, error
      format, OpenAPI generation, generated web client
- [x] Prisma setup, first migration: users, auth, organizations, workspaces
- [x] Decide on the auth library and record the decision
      ([D-020](DECISIONS.md#d-020-better-auth-behind-our-own-auth-module))
- [x] Auth: email + password (verification, reset), GitHub and Google OAuth,
      sessions
- [x] A personal organization is created automatically on sign-up; workspace
      CRUD and workspace switcher
- [x] Web shell: routing, layout, theming (light and dark), i18n (en and ko),
      responsive base
- [x] Repository files: `LICENSE` (AGPL-3.0), `ee/LICENSE`, `CONTRIBUTING.md`,
      CLA bot, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue and PR templates

**Exit checklist:** A new user can sign up in English or Korean, sign in with
a password or OAuth, and create a workspace. `docker compose up` runs the
whole stack. CI is green.

### Open items from phase 1

**Priority: low, deferred.** The approach to licensing and the contributor
agreement hasn't been decided yet, so these items wait until it is. They don't
block phase 2 or later development. The only hard deadlines are the ones below:
the first external pull request, and the first code in `ee/`.

**Before accepting the first external pull request:**

- [ ] Decide who the licensor is: the person or company that grants
      `ee/LICENSE` and receives the rights in `CLA.md`. Both currently say "the
      Flowbit maintainers", which is not a legal entity.
- [ ] Finalize `CLA.md` (still a draft): legal review, and decide whether it
      needs a clause that lets the rights be transferred to a successor (e.g. a
      company founded later).
- [ ] Replace the placeholder reporting contact `conduct@flowbit.invalid` in
      `CODE_OF_CONDUCT.md` with a real address.
- [x] Enable **Private vulnerability reporting** in the GitHub repository
      settings, so the link in `SECURITY.md` works.
- [ ] Confirm the CLA workflow (`.github/workflows/cla.yml`) works on a real
      pull request.

**Before shipping any code in `ee/` (phase 6):**

- [ ] Legal review of `ee/LICENSE` (still a draft), including how it interacts
      with the AGPL-licensed core.

---

## Phase 2: Boards, lists, cards

**Goal:** The core Trello loop, with live updates for everyone on the board.

- [ ] Boards: create, rename, delete, visibility (private, workspace),
      background color
- [ ] Lists: create, rename, reorder, move between boards
- [ ] Cards: create, edit title and description (Markdown), reorder, move
      between lists and boards
- [ ] Drag and drop with dnd-kit (mouse, touch, keyboard)
- [ ] Fractional-index ordering
      ([D-015](DECISIONS.md#d-015-fractional-indexing-for-ordering))
- [ ] Board and workspace roles, enforced in the API
- [ ] Optimistic UI updates with rollback on error
- [ ] **Real-time level 1:** domain events after commit, Socket.IO board
      rooms, Valkey adapter, client cache patching, echo suppression via
      `clientMutationId`
      ([D-010](DECISIONS.md#d-010-real-time-sync-over-websockets))
- [ ] Card detail view (modal with its own URL)
- [ ] End-to-end tests for the main board flows

**Exit checklist:** Two browsers on the same board see each other's card moves
and edits instantly. Permissions are enforced server-side. The board works on
a phone.

---

## Phase 3: Collaboration basics

**Goal:** A team can actually run its work on Flowbit.

- [ ] Invite members to a workspace or board (email invite and link invite),
      manage roles
- [ ] Card assignees
- [ ] Labels (per board, with color and name)
- [ ] Start and due dates, due-complete toggle
- [ ] Checklists with items (reorder, complete, assign, due date per item)
- [ ] Comments (Markdown, edit, delete, @mentions)
- [ ] Card covers, plus card badges on the board (due date, checklist
      progress, comment count)
- [ ] Board filters (by label, member, due date)
- [ ] Instance administration
      ([D-021](DECISIONS.md#d-021-instance-administrators-manage-accounts-not-content)):
      first account and `ADMIN_EMAILS` become instance admins; admin pages
      to list, suspend, reactivate and delete accounts, set a user's password,
      grant or revoke the admin role, toggle sign-up, and see instance
      statistics. No access to workspace content through this role.

**Exit checklist:** A small team can plan and track a project end to end
without leaving Flowbit. The person who runs the server can manage accounts
from the UI, including recovering a lost password without email.

---

## Phase 4: Presence, notifications, activity

**Goal:** People always know what changed and who is around.

- [ ] **Real-time level 2:** board presence (avatars of viewers), "editing"
      indicators
- [ ] Activity log for boards and cards (who did what, when)
- [ ] In-app notifications (mentions, assignments, due soon, comments on
      watched cards)
- [ ] Watch / unwatch cards and boards
- [ ] Email notifications (SMTP, localized), with per-user preferences
- [ ] Background job infrastructure (queue and scheduler on Valkey)

**Exit checklist:** A mention or assignment reaches the user in the app and
by email. Every change on a card shows up in its activity feed.

---

## Phase 5: Attachments, search, archive

**Goal:** The product is complete enough to replace Trello for everyday use.

- [ ] Attachment storage abstraction: local disk and S3-compatible drivers
      ([D-019](DECISIONS.md#d-019-attachment-storage-local-disk-or-any-s3-compatible-service))
- [ ] File attachments on cards (upload, preview images, size limits)
- [ ] Archive and restore for cards, lists and boards; permanent delete
- [ ] Search across cards, comments and boards (PostgreSQL full-text search)
- [ ] Board templates and copying boards
- [ ] PWA: installable, app icon, basic offline shell
      ([D-017](DECISIONS.md#d-017-responsive-web--pwa-for-mobile))
- [ ] Production self-hosting guide, backup and restore docs, versioned
      Docker images

**Exit checklist:** First public release candidate (`v1.0`).

---

## Phase 6: Enterprise

**Goal:** Ready for companies. These features live in `ee/` under the
commercial license
([D-011](DECISIONS.md#d-011-open-core-licensing-agpl-30--commercial-ee)).

- [ ] Organization UI: org settings, member directory, workspaces overview
- [ ] SSO: OIDC and SAML per organization, domain verification, enforced SSO
- [ ] SCIM user provisioning and deprovisioning
- [ ] Audit log (org-wide, exportable)
- [ ] Security policies (allowed sign-in methods, invite restrictions, session
      lifetime)
- [ ] License-key mechanism for activating `ee/` features
- [ ] Support impersonation: an instance admin signs in as a user to
      investigate a problem, always recorded in the audit log
      ([D-021](DECISIONS.md#d-021-instance-administrators-manage-accounts-not-content))
- [ ] SaaS concerns: billing integration, plan limits, tenant administration

**Exit checklist:** An organization can enforce SSO for its domain, see a full
audit trail, and manage all of its workspaces centrally.

---

## Phase 7: Extensions

**Goal:** Go beyond Trello. Order within this phase will be decided by user
demand.

### Views

- [ ] Table view (sort, filter, bulk edit)
- [ ] Calendar view (by start and due date)
- [ ] Timeline (Gantt) view
- [ ] Custom fields on cards (text, number, date, select, checkbox)

### Automation

- [ ] Rule engine: trigger, then conditions, then actions (e.g. "when a card
      moves to Done, complete all checklists")
- [ ] Scheduled rules (e.g. "every Monday at 9:00, create a card")
- [ ] Due-date rules (e.g. "one day before due, notify assignees")

### Integrations and import

- [ ] Personal API tokens and scoped API access
- [ ] Outgoing webhooks (signed, retried, with delivery logs)
- [ ] Trello import (board JSON export)
- [ ] Slack integration (notifications, create a card from a message)
- [ ] GitHub integration (link PRs and issues to cards, move a card when a PR
      is merged)

### AI (pluggable, off by default)

- [ ] Provider abstraction: users bring their own API key or a local model
- [ ] Summarize a card and its comment thread
- [ ] Create cards from natural language
- [ ] Suggest labels and assignees, split meeting notes into cards

### Later / to evaluate

- [ ] Real-time level 3: concurrent editing of card descriptions (CRDT)
- [ ] Native mobile apps
