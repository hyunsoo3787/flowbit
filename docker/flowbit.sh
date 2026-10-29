#!/bin/sh
# Server-side commands, e.g. `flowbit admin grant you@example.com` (D-021).
exec node /app/apps/api/dist/scripts/cli.js "$@"
