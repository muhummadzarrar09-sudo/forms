# Forensic codebase audit — 2026-07-25

## Scope and method

I reviewed every tracked file in this checkout, including application/API code, the Prisma schema and migration, scripts/configuration, tests/e2e tests, generated-style UI primitives, static assets, documentation, lockfile, and the tracked SQLite artifact. I specifically traced every public API route, ownership check, public-form rendering path, response/token lifecycle, database write, dynamic URL, JSON parse, and shell command. I also ran a repository secret-pattern scan and `npm audit --package-lock=false --omit=dev --legacy-peer-deps`. The latter reports **9 dependency vulnerabilities (5 high, 4 moderate)**. `bun` is not installed in this environment, so `bun run lint` and `bun test` could not be executed; the command fails with `bun: command not found`.

No current tracked `.env`, production connection string, private key, or production NextAuth secret was found. The test PostgreSQL password and NextAuth secret in `playwright.config.ts` are explicitly test-only. I did find real-looking personal data and password hashes in the tracked `db/custom.db` artifact.

## Critical

### C-01 — Tracked database artifact exposes personal data and password verifiers

- **File + line:** `db/custom.db` (binary SQLite database; `User` rows, no source line)
- **What is wrong:** The repository tracks a SQLite database containing three user records, including a personal Gmail address, names, and PBKDF2 password hashes. The running schema is PostgreSQL, so this is also an ungoverned, stale data artifact rather than a required runtime database.
- **Why it matters:** Any repository reader, fork, CI worker, or leaked archive receives personally identifiable information and offline password-verification material. Even strong password hashes should not be published: weak/reused passwords can be cracked offline. This also creates retention/privacy and incident-response obligations.
- **Suggested fix:** Immediately remove the file from Git and add `db/*.db` (or the appropriate local-data pattern) to `.gitignore`; replace it with a redacted fixture created only in tests if needed. Rotate/reset passwords for accounts represented by it, assess whether the email address is personal data subject to deletion obligations, and rewrite reachable Git history if the repository has ever been shared.

## High

### H-01 — Stored `javascript:` redirect can execute same-origin script in public forms

- **File + line:** `src/app/api/forms/[id]/endings/route.ts:78-86`; `src/app/api/forms/[id]/endings/[endingId]/route.ts:44-52`; rendered at `src/components/forms/form-filler.tsx:843-852` and `src/app/f/[slug]/slug-form-filler.tsx:429-437`
- **What is wrong:** Ending creation and update accept raw, unvalidated `redirectUrl` values. The value is later assigned directly to an anchor `href`. A form owner can store `javascript:...` (or other unsafe schemes), then distribute the public form. Clicking “Continue” executes it in the Forms origin.
- **Why it matters:** This is persistent stored XSS against respondents. If a signed-in creator visits a malicious public form on the same origin, the script can issue authenticated same-origin API requests and alter or exfiltrate data readable to that account. `rel="noopener noreferrer"` does not make a `javascript:` URL safe.
- **Suggested fix:** Centralize a strict redirect schema that accepts only absolute `https:` URLs (and optionally `http:` for explicitly non-production environments), rejects credentials and control characters, and use it in every ending create/update/bulk-update path. Validate again before rendering; do not render an invalid link. Add tests for `javascript:`, `data:`, protocol-relative, malformed, and valid HTTPS URLs.

### H-02 — Public response creation/update has no durable abuse protection and returns unbounded work to the database

- **File + line:** `src/app/api/forms/[id]/responses/route.ts:367-613` and `615-801`; `src/proxy.ts:35-59`; `src/lib/rate-limit.ts:1-121`
- **What is wrong:** Anyone can repeatedly create full or partial responses and repeatedly update a draft. The only middleware limits registration/login, not public response routes. The available limiter is process-local and explicitly resets on restart/cold start and is not shared among instances.
- **Why it matters:** A public form can be spammed, its database/storage and response analytics can be polluted, and PBKDF2-free but still substantial validation/transaction work can be used for denial of service. In a horizontally scaled/serverless deployment, the current Map does not provide a meaningful global control.
- **Suggested fix:** Put public submission and draft-update limits behind a shared atomic store (Redis/Upstash/database gateway), keyed by a trusted edge-provided client identity plus form ID. Add CAPTCHA/turnstile or an abuse policy for public forms, request-size limits, and monitoring. Do not trust arbitrary forwarded-IP headers unless the edge overwrites them.

### H-03 — Response listing and summary load every response/answer into memory without pagination or query limits

- **File + line:** `src/app/api/forms/[id]/responses/route.ts:245-298`; `src/app/api/forms/[id]/responses/summary/route.ts:20-121`
- **What is wrong:** The owner listing fetches all responses and all answer/question relations, then filters search results in application memory. The summary endpoint also loads every response, answer, and question before calculating aggregates. Query values have no length limits and no pagination/cursor.
- **Why it matters:** A successful form can become unable to view responses as data grows, with high database transfer/memory consumption and easy authenticated DoS. This is especially acute because the public submission endpoint permits unlimited spam.
- **Suggested fix:** Add cursor pagination and an upper page size, limit/validate query parameter lengths and date values, push search/filtering to indexed database queries where feasible, and calculate aggregate summaries in bounded/grouped SQL/Prisma queries. Separate detailed text-answer export from the summary path.

### H-04 — The database permits duplicate answers for one response/question; concurrent draft updates can corrupt results

- **File + line:** `prisma/schema.prisma:112-120`; `src/app/api/forms/[id]/responses/route.ts:724-746`
- **What is wrong:** `Answer` has no unique `(responseId, questionId)` constraint. The public draft-update code implements a read-then-create/update pattern using `findFirst`. Two concurrent requests with the same valid resume token can both observe no answer and create duplicates.
- **Why it matters:** Duplicate answers corrupt owner exports, summaries, required-answer merging, and recalculated scores. The present API-level duplicate check only handles duplicates inside one incoming request, not concurrent requests or existing bad data.
- **Suggested fix:** Add `@@unique([responseId, questionId])`, migrate/deduplicate existing rows first, and replace the read-then-write sequence with Prisma `upsert` on the compound key. Serialize or optimistic-lock updates to a response and add a concurrency integration test.

### H-05 — Authentication timing equalization is claimed but not performed; production login limits are bypassable

- **File + line:** `src/lib/auth.ts:7-9`, `34-48`; `src/lib/rate-limit.ts:23-40`; `src/proxy.ts:7-31`
- **What is wrong:** `DUMMY_PASSWORD_HASH` is generated but never used. A nonexistent account returns immediately after the DB lookup, while an existing account with a bad password performs PBKDF2. The per-email limiter and proxy IP limiter are separate in-memory Maps, reset on process restart, and are not shared across workers/instances; proxy code also consumes client-supplied forwarded-IP headers unless deployment guarantees sanitization.
- **Why it matters:** Login timing can help account enumeration. Distributed/cold-start attacks bypass the claimed rate limits, while shared NAT users can be incorrectly blocked.
- **Suggested fix:** Always evaluate `verifyPassword(credentials.password, user?.password ?? DUMMY_PASSWORD_HASH)` before branching on the user/password result. Replace both Maps with one shared atomic limiter at the trusted edge/application boundary, and derive the client IP only from infrastructure that removes inbound spoofed headers.

### H-06 — Multiple high-severity dependency advisories are currently resolvable from the declared dependency set

- **File + line:** `package.json:12-92`; `bun.lock`
- **What is wrong:** The dependency audit reported high advisories for `nodemailer <=9.0.0`, `js-yaml` through `@mdxeditor/editor`, `postcss`/`sharp` through the selected Next version, and `sharp <0.35.0`; it also reported moderate `prismjs` through `react-syntax-highlighter`. The audit found 9 vulnerabilities total (5 high, 4 moderate).
- **Why it matters:** Vulnerable transitive packages enlarge the reachable attack surface, even where a direct use is not obvious today. `sharp` is a production dependency and Next/OG rendering may make its dependency chain relevant.
- **Suggested fix:** Update direct dependencies to versions containing the fixes, regenerate `bun.lock` using Bun, and run the app/e2e suite after each breaking-major change. Add CI dependency auditing compatible with Bun’s lockfile and a scheduled update policy. Review reachability before accepting any compensating control.

## Medium

### M-01 — Ending API bypasses validation entirely, producing unsafe and inconsistent persisted data

- **File + line:** `src/app/api/forms/[id]/endings/route.ts:63-86`; `src/app/api/forms/[id]/endings/[endingId]/route.ts:37-52`
- **What is wrong:** Unlike forms, questions, and workspaces, ending handlers pass untyped request JSON directly to Prisma. Titles/messages have no type or length checks; booleans/order are unvalidated; redirects are not URL-validated. `body.title ||` also turns intentional empty strings into defaults inconsistently.
- **Why it matters:** Malformed requests become Prisma 500s rather than useful 400s, data can be arbitrarily large, and the missing URL validation enables H-01.
- **Suggested fix:** Add strict Zod create/update ending schemas (`.strict()` if unknown keys should be rejected), bounded strings, integer order bounds, and the shared safe HTTPS URL schema. Apply the same schema to the unused legacy/bulk ending branch in `src/app/api/forms/[id]/route.ts:144-228` or remove that branch.

### M-02 — Date handling accepts invalid values and has timezone-surprising end-date behavior

- **File + line:** `src/lib/validations.ts:97`; `src/app/api/forms/[id]/route.ts:177`; `src/app/api/forms/[id]/responses/route.ts:255-264`, `569`, `760-762`
- **What is wrong:** `closeDate` and public `completedAt` are arbitrary strings; they are converted with `new Date()` without a validity check. An invalid close date can become an ORM error/500 on update. Response list end dates use server-local `setHours(23,59,59,999)`, while incoming dates may be parsed as UTC, creating off-by-one-day results around timezones/DST.
- **Why it matters:** Form owners can receive unexplained failed saves and response filters can omit/include the wrong records. Client-controlled `completedAt` also makes duration analytics untrustworthy.
- **Suggested fix:** Require ISO-8601 datetimes with a Zod refinement for `!Number.isNaN(Date.parse(value))`; decide and document UTC-only or an explicit submitted timezone for date-only filters. Prefer server-set completion time unless client time is a separately labeled telemetry field.

### M-03 — Validation allows arbitrary question types and unbounded nested settings/metadata

- **File + line:** `src/lib/validations.ts:106-118`, `128-139`; `src/app/api/forms/[id]/responses/route.ts:13-33`
- **What is wrong:** Question `type` is `z.string().max(30)`, rather than the closed `QuestionType` enum, and `settings`/`metadata` are arbitrary records with unconstrained nested depth/size. Several runtime code paths only understand the known types.
- **Why it matters:** Invalid persisted question configuration creates inconsistent filler/server behavior and can drive oversized JSON storage/CPU work. It also weakens the promise that API-boundary validation prevents malformed data.
- **Suggested fix:** Use a `z.enum` for all supported question types; make a discriminated settings schema per type or at minimum cap record size/depth and validate known fields/ranges. Cap metadata keys, scalar sizes, and serialized byte length; reject prototype-polluting keys if later object merging is introduced.

### M-04 — Registration endpoint exposes existing-account membership and accepts weak passwords

- **File + line:** `src/app/api/auth/register/route.ts:18-30`, `41-49`; `src/components/login-page.tsx:57-59`
- **What is wrong:** Registration returns a distinct `409 An account with this email already exists`, while the password rule is only six characters.
- **Why it matters:** The distinct response permits account enumeration and six-character passwords materially reduce resistance to credential stuffing/offline attack should hashes leak (notably the tracked database artifact in C-01).
- **Suggested fix:** Return an enumeration-resistant generic registration result (or require email verification before revealing account state), use a stronger minimum/passphrase policy plus breached-password screening, and keep the UI and server policy in one shared schema.

### M-05 — Anonymous draft resume tokens are stored as plaintext, never expire, and remain valid until completion

- **File + line:** `prisma/schema.prisma:101-105`; `src/app/api/forms/[id]/responses/route.ts:454`, `647-650`
- **What is wrong:** A 32-byte token is well generated, but its plaintext is stored in the database and there is no expiry/revocation field. Any database read or log accident that obtains it can alter the associated incomplete response.
- **Why it matters:** This is a bearer credential protecting respondent data. Long-lived plaintext bearer secrets increase the impact of database exposure and make privacy deletion/expiry behavior undefined.
- **Suggested fix:** Store a one-way hash/HMAC of the token, compare the derived value, add `editTokenExpiresAt` and a cleanup job, and rotate/revoke it on sensitive lifecycle transitions. Do not log request bodies containing it.

### M-06 — Workspace deletion is a two-step non-transactional operation

- **File + line:** `src/app/api/workspaces/[id]/route.ts:137-146`
- **What is wrong:** The route nulls form workspace IDs and then deletes the workspace in separate database operations outside a transaction, despite the schema already declaring `onDelete: SetNull`.
- **Why it matters:** A failure between calls leaves a partially applied state; concurrent changes can produce unexpected reassignment behavior. The manual operation duplicates database referential behavior.
- **Suggested fix:** Delete the workspace directly and rely on the foreign-key `SetNull`, or wrap all required operations in one transaction. Add a failure/concurrency test.

### M-07 — Expensive synchronous password work runs on request handling and accepts a large attacker-controlled work factor

- **File + line:** `src/lib/crypto.ts:13`, `56-74`
- **What is wrong:** `pbkdf2Sync` blocks the Node event loop. Stored iteration counts up to 1,000,000 are accepted, so a malformed/poisoned stored hash can make each login expensive.
- **Why it matters:** Under concurrent login traffic, synchronous CPU work reduces service responsiveness. The cap limits the damage but remains several times the normal work factor.
- **Suggested fix:** Use asynchronous `crypto.pbkdf2` or a dedicated worker mechanism, restrict accepted legacy parameters to a known migration range, and rehash to the current policy after successful verification.

## Low

### L-01 — Dead notification-email module and duplicate response/filler implementations add maintenance risk

- **File + line:** `src/lib/email.ts:23-42` (no call sites); `src/components/forms/form-filler.tsx` (1,014 lines) and `src/app/f/[slug]/slug-form-filler.tsx` (595 lines)
- **What is wrong:** `sendNewResponseNotification` is never invoked, so SMTP configuration silently has no product effect. Public and in-app filler paths duplicate substantial navigation/submission/presentation responsibilities.
- **Why it matters:** Users may assume email notifications work when they do not. Duplicated filler behavior is likely to drift; token, validation, and redirect fixes must be implemented twice.
- **Suggested fix:** Either wire email delivery through an outbox/background job with observable status or remove the dead module/configuration. Extract one shared filler state machine/component and keep route-specific loading/auth wrappers small.

### L-02 — Password-hash migration is intentionally unsupported without a recovery path

- **File + line:** `src/lib/crypto.ts:31-52`; `src/lib/auth.ts:53-54`
- **What is wrong:** Legacy bcrypt hashes always fail; comments say affected users must re-register, but no password-reset flow is implemented.
- **Why it matters:** Any deployed account with a legacy hash is locked out, causing an avoidable availability/support incident.
- **Suggested fix:** Implement a verified password reset flow before release, or temporarily verify bcrypt and rehash to PBKDF2 on successful login. Inventory production hash formats before removing compatibility.

### L-03 — Silent catches conceal client persistence/autosave failures

- **File + line:** `src/components/forms/form-filler.tsx:448`, `479`; `src/store/form-store.ts:207-209`, `254`; `src/components/forms/design-panel.tsx:1316`, `1385`, `1400`
- **What is wrong:** Multiple catch blocks discard failures. The response draft autosave in particular ignores failed PUT responses and network errors.
- **Why it matters:** A respondent can believe their progress is saved when it is not; form creators can lose edits without feedback. This is inconsistent with the otherwise explicit API error handling.
- **Suggested fix:** Surface recoverable errors in the UI, check `response.ok`, retain/retry dirty state with bounded backoff, and log structured diagnostics without leaking sensitive response content.

### L-04 — A process-wide interval is started at module import and cleanup assumes a 15-minute maximum window

- **File + line:** `src/lib/rate-limit.ts:26-40`
- **What is wrong:** Importing the module starts a global `setInterval`; it is never unref’d/disposed. Cleanup hard-codes 15 minutes even though the API accepts any `windowSeconds`.
- **Why it matters:** This complicates tests/serverless lifecycle and can remove state incorrectly if a caller later configures a longer window.
- **Suggested fix:** Use a bounded shared limiter instead (H-05). Until then, avoid a background interval or derive retention from configured limits and call `.unref()` in Node.

### L-05 — Test configuration contains committed credentials, though they appear intentionally disposable

- **File + line:** `playwright.config.ts:6-9`; `docker-compose.test.yml:7-9`
- **What is wrong:** Test database credentials and a test NextAuth secret are hardcoded and committed.
- **Why it matters:** They are clearly test-only localhost credentials, so this is not a production-secret finding. However, copy/paste reuse into a non-test deployment would be unsafe.
- **Suggested fix:** Keep the explicit test-only comments, enforce `NODE_ENV === 'test'` before using them, and keep production environment loading separate. **Uncertain — needs human review:** confirm these values have never been used outside isolated local/CI test infrastructure.

## Overall health

The codebase has a solid baseline in several important areas: most owner routes consistently authenticate and verify ownership, Prisma use avoids raw SQL injection except for parameterized advisory locks, the public response edit token is cryptographically random and deliberately omitted from owner listings, input validation exists on major form/workspace/question routes, and no current tracked production secret was found. However, it is not production-ready until the tracked database/privacy exposure, persistent unsafe redirects, public endpoint abuse controls, duplicate-answer concurrency flaw, and vulnerable dependencies are resolved. The largest engineering risk is scale and drift: large duplicated filler/editor components, unbounded response reads, raw ending APIs, and inconsistent error handling will make correctness and security fixes expensive unless the API schemas, response write model, and shared UI state are consolidated.
