# Batch 1 — Foundation & Security Execution

**Completed locally:** 2026-07-20. Nothing has been committed, pushed, migrated, or deployed.

## Delivered changes

### Secret/repository containment

- Kept `.env` removed from Git tracking and explicitly ignored for future commits.
- Kept Git history rewrite deferred as requested. **Credential rotation and history purge are still mandatory before any deploy.**

### Attack-surface reduction

- Replaced the query-controlled Caddy port proxy with a fixed-upstream production template, explicit hostname placeholder, compression, and baseline response headers.
- Removed unreferenced unauthenticated Socket.IO example files and the unsafe `XTransformPort` convention.
- Removed unused legacy public partial-response route files.

### Authorization and response integrity

- Form create/update now verifies that supplied `workspaceId` belongs to the authenticated user.
- Transactional form save now verifies every supplied existing ending ID belongs to the owned URL form before update/delete.
- Response submit and partial update reject duplicate or foreign question IDs rather than accepting them or failing at a foreign key.
- Partial responses require a cryptographically random 32-byte bearer resume token to update. The token is returned once when the partial is created and deliberately stripped from owner response listings.
- Partial-response creation/update reject unpublished forms; updates only permit an unfinished partial response.
- Completed submissions use a transaction-scoped PostgreSQL advisory lock per form, then reload the form/cap while locked. Count applies to completed responses only, preventing partials from consuming the public cap.

### Authentication hardening

- New PBKDF2-SHA512 hashes use 210,000 iterations; a 32-byte random salt and timing-safe comparison remain in use.
- Invalid/extreme PBKDF2 work factors are rejected before expensive derivation.
- Missing accounts now execute a dummy PBKDF2 verification before returning, removing the obvious missing-user vs wrong-password timing branch.

### Type/build health

- Corrected the batch-question TypeScript array type, serialisation type/date mismatches, workspace data shape, debounce refs/generics, response viewer handlers, chart tooltip typing, and Framer Motion type declarations.
- Added `nodemailer` and its type package because `src/lib/email.ts` is compiled by TypeScript.
- Added the first explicit PostgreSQL migration file for `Response.editToken`.

## Verification actually run

| Check | Result |
| --- | --- |
| `bunx tsc --noEmit` | passed, exit 0 |
| `bun run lint` | passed, exit 0 |
| `bun run build` | passed, exit 0 |
| `npx prisma validate` | passed |
| PBKDF2 smoke test | new work factor `210000`; correct password true; wrong password false; excessive factor rejected |
| `git diff --check` | passed |

Next’s own build output continues to state that it skips type validation; the separately executed passing `tsc` command is the type gate.

## Important deployment/migration caveats

1. The project has no pre-existing Prisma migration history and contains a stale SQLite file while its active Prisma datasource is PostgreSQL. The added migration is a **forward migration only**, not a database baseline. Do not run it blindly against production.
2. Take a database backup, inventory/establish the current production schema, baseline the migration history under change control, then apply the new migration to staging before production.
3. Existing partial responses have `editToken = NULL` and intentionally cannot be resumed after this migration.
4. PostgreSQL advisory locking is intentionally PostgreSQL-specific. This matches the current Prisma datasource, but confirms that SQLite must not remain a claimed production target.
5. In-memory distributed rate limits are still a production limitation. Replacing them with a shared durable limiter is scheduled for the next security batch.
6. These changes need endpoint-level integration tests against an isolated PostgreSQL database before deploy; no client production data was changed.
