# Self-hosting Flowbit

Flowbit runs as a single container next to PostgreSQL and Valkey. The provided
`docker-compose.yml` starts all three.

> Flowbit is pre-1.0. Expect breaking changes between versions until `v1.0`,
> and back up your database before upgrading.

## Quick start

Requirements: Docker with the Compose plugin.

```sh
git clone https://github.com/hyunsoo3787/flowbit.git
cd flowbit
cp .env.example .env
```

Edit `.env`:

- `AUTH_SECRET`: a random secret, e.g. the output of `openssl rand -base64 32`.
  Changing it later signs everyone out.
- `PUBLIC_URL`: the exact URL people will use, e.g. `https://flowbit.example.com`.
- `POSTGRES_PASSWORD`: a password for the bundled database.

Then start it:

```sh
docker compose up -d
```

Database migrations run automatically when the container starts. Then create
the first administrator (see [Administration](#administration)):

```sh
docker compose logs flowbit | grep setup
```

Open the printed `/setup?token=…` link. It creates an administrator account,
works once, and stops working as soon as an administrator exists.

## Configuration

All settings are environment variables, set in `.env`:

| Variable                                    | Default                        | Description                                                                                    |
| ------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`                                | `http://localhost:3000`        | The URL users open. Used for links in emails and OAuth callbacks.                              |
| `AUTH_SECRET`                               | (required)                     | Secret for signing sessions and tokens. At least 32 characters.                                |
| `FLOWBIT_PORT`                              | `3000`                         | Host port the app is published on.                                                             |
| `POSTGRES_PASSWORD`                         | `flowbit`                      | Password of the bundled PostgreSQL.                                                            |
| `AUTH_DISABLE_SIGN_UP`                      | `false`                        | Start with sign-up closed. Administrators can change it later on the admin page.               |
| `ADMIN_EMAILS`                              | (none)                         | Comma-separated administrator emails. Only with email verification on, for verified addresses. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION`           | `true` if SMTP is set          | Require users to verify their email before signing in.                                         |
| `AUTH_RATE_LIMIT`                           | `true`                         | Rate-limit sign-in, sign-up and password reset attempts.                                       |
| `SMTP_URL`                                  | (none)                         | e.g. `smtps://user:pass@smtp.example.com:465`. Without it, emails are only written to the log. |
| `MAIL_FROM`                                 | `Flowbit <no-reply@localhost>` | Sender of outgoing emails.                                                                     |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | (none)                         | Enables "Continue with GitHub".                                                                |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | (none)                         | Enables "Continue with Google".                                                                |
| `LOG_LEVEL`                                 | `info`                         | `error`, `warn`, `info` or `debug`.                                                            |
| `FLOWBIT_MIGRATE_ON_START`                  | `true`                         | Set to `false` to run migrations yourself (see below).                                         |

### Email

Flowbit sends account emails (verification, password reset), invitations and
notifications: mentions, assignments, activity on cards people watch, and
due date reminders. Everyone chooses which notifications they also get by
email in their account menu → Notifications.

Configure `SMTP_URL` for production. Without it, verification and password
reset links are only printed in the logs (`docker compose logs flowbit`), and
email verification isn't required.

### Sign in with GitHub or Google

Create an OAuth app with the provider and use these callback URLs:

- GitHub: `${PUBLIC_URL}/api/auth/callback/github`
- Google: `${PUBLIC_URL}/api/auth/callback/google`

## Administration

Instance administrators manage accounts and server settings; the role never
gives access to anyone's boards ([D-021](DECISIONS.md#d-021-instance-administrators-manage-accounts-not-content)).
Administrators find **Administration** in their account menu, where they can:

- see how many accounts, workspaces and boards the server has;
- open or close sign-up (when closed, people invited by email can still sign
  up);
- search accounts, suspend and reactivate them (suspending signs the person
  out), and delete them. Workspaces that other people still use are handed over
  to one of their admins rather than deleted;
- create a one-time **password reset link** for someone who forgot their
  password, to give to them directly. This is how you help users on a server
  without email;
- make other accounts administrators, and see a log of all of the above.

**The first administrator** is created with the one-time setup link that the
server prints to its log while it has no administrator. If you lost it, print
it again:

```sh
docker compose exec flowbit flowbit admin setup-url
```

**From the command line** you can also add or remove administrators at any
time, for example if every administrator account was lost:

```sh
docker compose exec flowbit flowbit admin grant you@example.com
docker compose exec flowbit flowbit admin revoke someone@example.com
docker compose exec flowbit flowbit admin list
```

## HTTPS and reverse proxies

Run Flowbit behind a reverse proxy that terminates TLS (Caddy, nginx, Traefik,
a cloud load balancer) and set `PUBLIC_URL` to the `https://` address. Session
cookies are marked `Secure` automatically when `PUBLIC_URL` uses HTTPS. The proxy
must forward WebSocket connections (needed from phase 2 for real-time updates).

Example with Caddy:

```
flowbit.example.com {
  reverse_proxy localhost:3000
}
```

## Upgrading

```sh
git pull
docker compose build
docker compose up -d
```

Migrations run on startup. To run them as a separate step instead, set
`FLOWBIT_MIGRATE_ON_START=false` and run:

```sh
docker compose run --rm flowbit node /app/apps/api/node_modules/prisma/build/index.js migrate deploy
```

## Backups

All persistent data lives in PostgreSQL. Valkey holds no durable state.

```sh
# Back up
docker compose exec -T postgres pg_dump -U flowbit -Fc flowbit > flowbit-$(date +%F).dump

# Restore into an empty database
docker compose exec -T postgres pg_restore -U flowbit -d flowbit --clean --if-exists < flowbit-2026-01-01.dump
```

## Health check

`GET /api/v1/health` returns `200` with the status of PostgreSQL and Valkey, or
`503` if one of them is down. The container's built-in health check uses it.
