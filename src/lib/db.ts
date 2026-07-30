import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Supabase + Prisma + PgBouncer notes:
 *
 * - DATABASE_URL must be the **pooled** connection (port 6543, Supabase pooler)
 *   with `?pgbouncer=true&connection_limit=1` – this tells Prisma to disable
 *   prepared statements and keep the serverless connection count low.
 *   Typical error without it: `prepared statement "s0" already exists` /
 *   `does not exist` because PgBouncer transaction mode doesn't support
 *   prepared statements.
 *
 * - DIRECT_URL must be the **direct** connection (port 5432) and is used for
 *   `prisma migrate` / `db push`. Never put the pooled URL in DIRECT_URL.
 *
 * - Common Supabase logs fixed by this:
 *   - `FATAL: MaxClientsInSessionMode` / `too many clients` -> fixed by
 *     singleton + `connection_limit=1`
 *   - `remaining connection slots are reserved` -> same cause
 *   - `P1001 Can't reach database server` -> often IPv6 vs IPv4 + missing pooler
 *   - Advisory lock raw queries must use $executeRaw (not $queryRaw) when
 *     behind PgBouncer.
 */
function createPrismaClient() {
  const isDev = process.env.NODE_ENV === 'development';

  // In production (Vercel / serverless) we must still reuse the global to avoid
  // exhausting Supabase connections on hot reload / function reuse.
  // The previous version only cached in dev, leading to "too many clients" logs.
  const client = new PrismaClient({
    log: isDev ? ['error', 'warn'] : ['error'],
    // With DATABASE_URL containing ?pgbouncer=true Prisma automatically
    // disables prepared statements and uses the direct protocol expected by
    // PgBouncer transaction mode.
  });

  if (isDev && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('pgbouncer')) {
    console.warn(
      '[DB] DATABASE_URL should include ?pgbouncer=true&connection_limit=1 for Supabase. ' +
        'See https://supabase.com/docs/guides/database/prisma and docs/DEPLOYMENT.md'
    );
  }

  return client;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

// Persist the singleton in *all* environments. Vercel reuses the same
// container for multiple invocations – without this every request would
// create a new pool and log `MaxClientsInSessionMode` / `remaining connection
// slots are reserved`.
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db;
}

