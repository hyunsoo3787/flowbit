#!/bin/sh
set -e

# Apply pending database migrations before starting, unless disabled
# (e.g. when migrations run as a separate release step).
if [ "${FLOWBIT_MIGRATE_ON_START:-true}" = "true" ]; then
  echo "Applying database migrations…"
  node /app/apps/api/node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"
