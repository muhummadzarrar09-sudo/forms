#!/usr/bin/env bash
set -euo pipefail

echo "The Prisma/Docker test database workflow has been retired for the Supabase Auth + SQL Editor cutover." >&2
echo "Do not run prisma db push/migrate against an existing Supabase project." >&2
echo "Run supabase/sql/0000_preflight_existing_prisma_database.sql and follow supabase/README.md instead." >&2
exit 1
