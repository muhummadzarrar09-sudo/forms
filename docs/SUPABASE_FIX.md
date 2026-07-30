# Supabase logs — what they mean and how this repo fixes them

## Your actual logs (2026-07-30)

You pasted Supabase **Realtime** logs, not Postgres logs:

```
MigrationsFailedToRun: %DBConnection.ConnectionError{
  message: "[Elixir.Realtime.Tenants.Migrations.DynamicSupervisor] 
  connection not available and request was dropped from queue after 15000ms. 
  This means requests are coming in and your connection pool cannot serve them 
  fast enough."
}
Could not create schema migrations table.
Database supervisor not found for tenant jbfbdfbavrldwyrdwajj
Applying migrations to 2406:da14:271:9922:b5e3:725e:c8db:3abc
Finished applying 12 migrations for tenant jbfbdfbavrldwyrdwajj in 20445ms
```

**Translation:**
- Supabase has an internal Elixir service called **Realtime** (separate from your app). It needs its own Postgres connections.
- When your app (Prisma) hogs all connections, Realtime can't get a connection within 15s -> queue_timeout.
- Then it fails to create/check its `schema_migrations` table and logs `supervisor not found`.
- The `2406:da14:...` IPv6 is Realtime's worker trying to connect.
- Final `Finished applying 12 migrations... in 20445ms` means it eventually succeeded after 20s retry — but the errors still spam logs.

**Why it started after the recent merge (PR #4):**

PR #4 fixed the Next 16 `middleware → proxy` conflict, but kept this old `db.ts`:

```ts
export const db = globalForPrisma.prisma ?? new PrismaClient(...)
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

In production (Vercel/serverless), it **never** cached the client. Every serverless invocation opened a new pool. Supabase free tier = ~60 direct / ~200 pooled max. After a few cold starts, Prisma consumed all slots, starving Realtime -> your logs.

This app does **not** use Supabase Realtime at all (no `supabase-js` Realtime client), so those logs are pure side-effects of connection exhaustion.

## Fixes already applied in this branch

### 1. `src/lib/db.ts` — singleton in ALL envs + PgBouncer guidance

```ts
function createPrismaClient() {
  return new PrismaClient({
    log: ...,
    // DATABASE_URL must contain ?pgbouncer=true&connection_limit=1
  })
}
export const db = globalForPrisma.prisma ?? createPrismaClient()
if (!globalForPrisma.prisma) globalForPrisma.prisma = db
```

- Now Vercel reuses container -> 1 pool instead of N pools
- Plus `connection_limit=1` per function -> max ~ few connections instead of hundreds
- Dev warning if `DATABASE_URL` missing `pgbouncer=true`

This alone fixes your `MigrationsFailedToRun` / `supervisor not found` logs.

### 2. Prepared statement logs (`s0 already exists`) — related but not in your paste, but will appear next

Supabase pooler (PgBouncer transaction mode) doesn't support prepared statements.

Previously:
- `tx.$queryRaw` for `pg_advisory_xact_lock`
- `$queryRaw` in summary + health
- `db.$transaction([ a, b ])` batches

**Fix:**
- Advisory locks → `$executeRaw`
- Summary & health → `$queryRawUnsafe( "... WHERE \"formId\" = $1", id )`
- All batch transactions → `db.$transaction(async (tx) => { await tx... })`

### 3. Postgres vs Pooled URLs

Correct (from Supabase dashboard → Database → Connection String):

```
DATABASE_URL="postgresql://postgres.REF:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20"
DIRECT_URL="postgresql://postgres.REF:PASS@aws-0-REGION.pooler.supabase.com:5432/postgres"
# or db.REF.supabase.co:5432
```

- `DATABASE_URL` = **pooler, 6543** + `pgbouncer=true&connection_limit=1` → app runtime
- `DIRECT_URL` = **direct, 5432** → only for `prisma migrate deploy` / `db push`

Using `db.REF.supabase.co` (IPv6-only) for DATABASE_URL from Vercel also causes `P1001 Can't reach database server`. The `aws-0-...pooler.supabase.com` host is IPv4-compatible.

## What you should do now

**In code:** Already fixed in this branch `arena/019fb277-forms` — merged to `main` after review will stop exhausting connections.

**In Supabase dashboard (one time):**

1. **Database → Connection Pooling:** Copy Transaction pooler URL, add `?pgbouncer=true&connection_limit=1&pool_timeout=20`

2. **Database → Realtime:** This forms app does NOT use Realtime. If you don't need it:
   - Go to **Database → Realtime → Disable** or disable publication for your tables
   - This completely stops the `DynamicSupervisor` logs, reduces connection usage
   - If you do need Realtime later, re-enable after fixing connections

3. **Database → Roles / Pool Monitor:** Check `pg_stat_activity` — should drop from 50+ to <10 active after fix

4. **Restart project (if stuck):** Project Settings → General → Restart. Clears the Elixir supervisor queue that logged `Database supervisor not found`.

5. **Vercel env:** Set both `DATABASE_URL` (pooled + pgbouncer) and `DIRECT_URL` (direct). Redeploy.

After deploy, watch **Logs → Postgres logs** and **Realtime logs** — you should see:
- No more `queue_timeout`
- Only `Finished applying 12 migrations in ...ms` once on deploy, not repeated errors

## If you still see logs

- Check Vercel logs for `[DB] DATABASE_URL should include ?pgbouncer=true` warning — means env is still wrong
- Ensure no other project / local `bun run dev` is pointing to same Supabase DB and hogging connections
- In Supabase: **Project is paused** can also cause same `DBConnection.ConnectionError` — unpause.

## References

- Supabase + Prisma guide: https://supabase.com/docs/guides/database/prisma
- Prisma PgBouncer: https://www.prisma.io/docs/orm/prisma-client/deployment/connection-pooling#configuring-pgbouncer-mode
- GitHub issue: `prepared statement s0` https://github.com/prisma/prisma/issues/18442
- Supabase Realtime connection pool: https://github.com/supabase/realtime/issues/611
