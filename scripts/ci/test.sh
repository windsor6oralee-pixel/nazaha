#!/usr/bin/env bash
# The single source of truth for "does this commit pass" — run by CI and locally alike.
# Requires: a reachable PostgreSQL (DIRECT_DATABASE_URL as owner) and APP_DB_PASSWORD.
set -euo pipefail

: "${DIRECT_DATABASE_URL:?owner connection string}"
: "${DATABASE_URL:?runtime connection string (nazaha_app)}"
: "${APP_DB_PASSWORD:?password for the nazaha_app role}"

step() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }

step "Dependency policy"
node scripts/ci/check-deps.mjs

step "Prisma client"
npx prisma generate

step "Migrations (owner role)"
npx prisma migrate deploy

step "Runtime role password"
if command -v psql >/dev/null; then
  bash scripts/db/set-app-role-password.sh
else
  # No psql binary (e.g. local dev): run the same statement through Prisma on the owner connection.
  DATABASE_URL="$DIRECT_DATABASE_URL" node --input-type=module -e "
    import { PrismaClient } from '@prisma/client';
    const p = new PrismaClient();
    const pw = process.env.APP_DB_PASSWORD.replace(/'/g, \"''\");
    await p.\$executeRawUnsafe(\"ALTER ROLE nazaha_app WITH PASSWORD '\" + pw + \"'\");
    await p.\$disconnect();
    console.log('nazaha_app password set via owner connection');
  "
fi

step "Schema ↔ migrations drift"
npx prisma migrate diff --from-url "$DIRECT_DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code

step "Seed (runtime role, subject to RLS)"
npx prisma db seed

step "Type check"
npx tsc --noEmit

step "Lint"
npx eslint .

step "Integration tests"
npx vitest run

step "Production build"
npx next build

printf '\n\033[1;32m✔ all gates passed\033[0m\n'
