#!/usr/bin/env bash
# Sets the password of the runtime DB role (nazaha_app) from APP_DB_PASSWORD.
# Run once after `prisma migrate deploy` on a fresh database, using the owner connection.
# The statement is piped over stdin so the password never appears in argv or shell history.
set -euo pipefail
: "${DIRECT_DATABASE_URL:?set DIRECT_DATABASE_URL (owner connection)}"
: "${APP_DB_PASSWORD:?set APP_DB_PASSWORD}"
# Prisma connection strings carry "?schema=public", which psql rejects as an invalid URI
# parameter (exit 2). Strip it; the role change is schema-independent anyway.
psql_url="$(printf '%s' "$DIRECT_DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"
printf "ALTER ROLE nazaha_app WITH PASSWORD '%s';\n" "${APP_DB_PASSWORD//\'/\'\'}" \
  | psql "$psql_url" -v ON_ERROR_STOP=1 -q
echo "nazaha_app password updated"
