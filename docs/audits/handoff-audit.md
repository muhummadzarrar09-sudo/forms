# White-Glove Handoff Audit — Forms App

**Audit date:** 2026-07-20 (PKT)  
**Repository commit audited:** `cd539cc` (`Fixed the og`)  
**Live target:** `https://formsv1.vercel.app`  
**Decision:** **DO NOT HAND OFF.** Critical credential, authorization, data-integrity, and deployment failures remain.

## What was actually verified

- Cloned the repository fresh and inspected every route under `src/app/api/`, auth/rate-limit/crypto code, Prisma schema, Caddyfile, deployment scripts, filler implementations, upload/download directories, and the WebSocket/mini-service artifacts.
- Ran a clean `bun install --frozen-lockfile` after removing `node_modules` and `.next`.
- Ran `bun run lint`: **0 errors/warnings, exit 0**.
- Ran `bunx tsc --noEmit`: **28 errors, exit 2** (details below).
- Ran `bun run build`: **exit 0**. Next reports that it **skips type validation**, so this is not evidence that TypeScript is healthy. Build used Turbopack; the repository's `dev` script correctly remains `next dev -p 3000 --webpack` and was not changed.
- Ran `npx prisma validate`: schema syntax is valid. This does **not** establish that it matches a database.
- Performed non-destructive live HTTP tests: `GET /api/forms` anonymously returned **401**, `GET /api` returned **200**, and an unknown public filler URL (`/f/does-not-exist`) returned **500**, not a 404.
- Did **not** create accounts, modify production forms, submit production responses, or load-test the production database. No client test account/approved disposable environment was supplied. Therefore the requested authenticated 14-type build/fill/export, real concurrent submissions, kill-mid-save, cross-device visual, and keyboard-browser tests cannot truthfully be marked passed.

## Remediation performed in this audit checkout

`.env` was removed from the Git index with `git rm --cached .env`, while left locally present for development, and an explicit `.env` entry was appended to `.gitignore`. Current pending changes are:

```text
D  .env
 M .gitignore
```

This only fixes future commits. It does **not** erase existing secrets from the repository history. Do not commit/push this as the only remediation; rotate secrets first and rewrite history.

---

# 1. Critical — must fix before handoff

## C-01 — Live database credentials and NextAuth signing secret are committed in `.env`

- **Location:** root `.env`; present in Git history (six commits reference the path).
- **What is wrong:** The tracked file contains a Supabase PostgreSQL username/password in both `DATABASE_URL` and `DIRECT_URL`, plus `NEXTAUTH_SECRET`. These are live-looking, usable credentials, not placeholders. Anyone with repository/history access can access the database and forge/validate NextAuth JWTs.
- **How verified:** `git ls-files .env` returned `.env`; `git show HEAD:.env` showed the connection strings and secret. History inspection found six commits containing the path.
- **Suggested fix:** Immediately revoke/rotate the Supabase database password and `NEXTAUTH_SECRET` (and invalidate existing sessions), remove `.env` from the index, keep only a redacted `.env.example`, and rewrite *all* reachable Git history (for example `git filter-repo`) before force-pushing. Coordinate cloning/redeploying after the rewrite. The local index/ignore remediation described above is ready but intentionally uncommitted.

## C-02 — Owner form update can modify or delete endings belonging to another form/user (IDOR)

- **Location:** `src/app/api/forms/[id]/route.ts`, PUT transaction, endings CRUD loop (approximately lines 150–205).
- **What is wrong:** The route verifies ownership of the URL form, but its `tx.formEnding.update({ where: { id: e.id } })` and `delete({ where: { id: e.id } })` do not verify that the ending belongs to that form. An authenticated owner of any form can put another form's ending ID in their PUT payload and mutate/delete it.
- **How verified:** Static route trace. The dedicated endings routes correctly compare `existingEnding.formId !== id`; the transactional bulk path omits that check.
- **Suggested fix:** Scope mutations by `(id, formId)` (add a composite unique key if necessary) or first fetch all ending IDs for the owned form and reject IDs outside that set. Use `deleteMany({ where: { id, formId: id }})` and verify the affected count. Add two-user integration tests for every endpoint/path, including this bulk-save path.

## C-03 — Response cap transaction does not serialize concurrent PostgreSQL submissions

- **Location:** `src/app/api/forms/[id]/responses/route.ts:319–357`.
- **What is wrong:** Moving `count()` inside a normal Prisma transaction does not close the race on PostgreSQL’s default `READ COMMITTED` isolation: two transactions can both count below `maxResponses`, both insert, and commit over the cap. It also reads `form.maxResponses` outside the transaction, so a concurrent cap change is not serialized with submission.
- **How verified:** Code review against the configured production datasource (`provider = "postgresql"`). The transaction contains an unlocked aggregate read followed by an insert; there is no row lock, serializable isolation/retry, atomic counter, or database constraint. A real 20-parallel boundary test could not safely be run against the client production database without authorization.
- **Suggested fix:** Serialize on the form row (`SELECT ... FOR UPDATE` via a safe Prisma/raw query), use a serializable transaction with retry on serialization conflict, or maintain an atomic accepted-response counter with a conditional `UPDATE ... WHERE count < maxResponses`. Count only the intended completed responses if partials should not consume the cap. Add an isolated test database integration test that fires 20 simultaneous requests at a cap of one and asserts exactly one 201.

## C-04 — Public response endpoints accept foreign question IDs and unauthenticated partial-response modification

- **Location:** `src/app/api/forms/[id]/responses/route.ts` POST/PUT; `src/app/api/forms/[id]/responses/partial/route.ts`; `src/app/api/forms/[id]/responses/partial/[responseId]/route.ts`.
- **What is wrong:**
  1. Completed and partial submissions validate only that `questionId` is a nonempty string; they never require every question to belong to URL form `id`. Existing question IDs from another form can be attached to the target response. Invalid IDs cause FK errors rather than a clean validation error.
  2. Public partial-update APIs treat an opaque response ID as sole authority. Anyone who obtains a respondent’s ID can alter its answers, completion state, metadata, or score; no signed respondent token/session is required.
  3. Both legacy partial route and the `isPartial` branch query `published` but do not enforce it, allowing public creation of partial records for unpublished forms. These endpoints are actually wired into `form-filler.tsx`.
- **How verified:** Route trace: a `questionMap` is built only for scoring, not validation; answer creates use caller-supplied `questionId`. `PUT` merely checks `existingResponse.formId === id`; neither it nor the legacy PATCH has a respondent credential. The legacy route selects `{ published: true }` and never evaluates it.
- **Suggested fix:** Fetch IDs for the target form inside the write transaction and reject unknown/duplicate/missing required answers. Remove duplicate legacy partial endpoints. Issue a cryptographically random, hashed/signed response-edit token at partial creation and require it for all public partial updates (or do not persist partials). Require published/open form status and apply response-rate/abuse limits.

## C-05 — Caddy configuration is an unauthenticated localhost open proxy / port scanner if deployed

- **Location:** `Caddyfile`, `@transform_port_query` handler.
- **What is wrong:** Any request with `?XTransformPort=<value>` is reverse-proxied to `localhost:{query.XTransformPort}`. This exposes arbitrary local TCP HTTP services through the public Caddy listener and is not appropriate for production.
- **How verified:** Direct configuration trace. `examples/websocket/frontend.tsx` explicitly relies on this feature for port 3003. The live target is Vercel and ignored the parameter, but the repository’s claimed Caddy deployment path would expose it.
- **Suggested fix:** Delete this query-controlled handler and the demo service. Use fixed, path-based upstreams only, e.g. proxy `/socket.io/*` to one fixed authenticated service if it is genuinely required. Bind internal services to loopback/private network, set an explicit host/domain, and test from an external host.

---

# 2. High — client-visible broken functionality / serious security risk

## H-01 — Public slug filler and in-app filler have substantially drifted

- **Location:** `src/app/f/[slug]/slug-form-filler.tsx` vs `src/components/forms/form-filler.tsx`.
- **What is wrong:** These are forked copies, not shared logic. The diff is large and functional: slug filler does not collect URL hidden fields, does not create/update partial responses, and has separate logic/submission/end-screen code. The in-app filler includes those behaviors and preview-specific behavior. Further manual synchronization will regress one path.
- **How verified:** Direct unified diff and call-site trace. `src/app/f/[slug]/page.tsx` renders `SlugFormFiller`; `/` renders `FormFiller` through store state. Hidden-field code exists only in `FormFiller`.
- **Suggested fix:** Extract a single parameterized filler engine/hooks/components and use adapters only for data loading/preview behavior. Add one shared Playwright suite that drives both routes and checks the same answers, logic, endings, redirect, hidden fields, accessibility, and response output.

## H-02 — Hidden fields break dashboard/share submission and slug route silently drops them

- **Location:** `src/components/forms/form-filler.tsx:~520,~530`; `src/app/f/[slug]/slug-form-filler.tsx`.
- **What is wrong:** The in-app filler submits fabricated IDs such as `__hidden_<fieldId>` as `Answer.questionId`. No matching Question exists, so database foreign-key enforcement should reject the response. The slug filler removes hidden field extraction entirely, so public respondents’ URL parameters are lost.
- **How verified:** Static request/DB relation trace; `Answer.questionId` is a required FK and the response API has no special handling. Direct filler diff confirms public route does not collect/include them.
- **Suggested fix:** Model hidden values separately (e.g. validated response metadata or a `HiddenAnswer` model), never as fake question FKs. Define an explicit privacy policy for them and test both fillers with URL parameters.

## H-03 — Conditional logic has no multi-condition support and can loop indefinitely

- **Location:** `src/lib/validations.ts` (`logicRuleSchema`); both filler `goNext` implementations.
- **What is wrong:** The schema permits exactly one `condition` per rule; there is no AND/OR condition group, so the requested multi-condition logic cannot be built/stored. Navigation permits a rule to jump to the same question or an earlier question with no cycle detection/visited-state/maximum-step protection, causing a respondent trap.
- **How verified:** Schema inspection and line-by-line `goNext` trace. It executes first matching rule and sets `currentIndex` to any matching target; no forward-only/cycle guard exists.
- **Suggested fix:** Establish a logic AST (`all`/`any` condition arrays), validate target types/ownership, and lint/reject self/cyclic routes at save time (or impose a deterministic runtime visit limit with recovery). Add tests for AND, OR, rule precedence, a skipped required field, custom ending, self-loop, two-node loop, and invalid target.

## H-04 — API permits cross-user workspace association

- **Location:** `src/app/api/forms/route.ts` POST; `src/app/api/forms/[id]/route.ts` PUT.
- **What is wrong:** A form owner can provide any `workspaceId`; neither route verifies that the workspace belongs to them. This corrupts tenant/workspace isolation and can make a victim workspace list another user’s form and its data.
- **How verified:** Both code paths directly set `workspaceId`; no workspace lookup/`userId` condition is performed. Workspace GET includes all forms assigned to the owned workspace.
- **Suggested fix:** Verify `{ id: workspaceId, userId: session.user.id }` in the same transaction before assigning; reject non-owned IDs. Test with two users.

## H-05 — Existing bcrypt accounts are intentionally locked out; committed SQLite snapshot is a stale data artifact

- **Location:** `src/lib/crypto.ts:37–42`, `src/lib/auth.ts`; tracked `db/custom.db`.
- **What is wrong:** Legacy bcrypt hashes always return false, with no reset/migration flow. The repository also contains a tracked SQLite database that is inconsistent with the PostgreSQL runtime schema and contains three user records; its password prefixes are old PBKDF2 at 10,000 iterations. This proves repository data artifacts exist but does not prove production user hash distribution.
- **How verified:** `verifyPassword` explicitly returns false for `$2a$`/`$2b$`. Read-only SQLite inspection found User/Form/etc. tables and three user records, while `schema.prisma` configures PostgreSQL.
- **Suggested fix:** Before launch, inventory the production password formats safely. Support verified bcrypt-to-PBKDF2 rehash on successful login or deploy a forced password-reset flow before removing bcrypt verification. Remove/replace the tracked database fixture with sanitized test data.

## H-06 — Password and login rate-limit implementation do not meet production security claims

- **Location:** `src/lib/crypto.ts`; `src/lib/auth.ts`; `src/lib/rate-limit.ts`; `src/middleware.ts`.
- **What is wrong:** PBKDF2-SHA512 has a good 32-byte random salt, 64-byte derived key, stored parameters, and timing-safe hash comparison, but uses only **100,000 iterations** (below contemporary OWASP PBKDF2-HMAC-SHA512 guidance). Missing-user login returns after a DB lookup without running PBKDF2, while wrong-password login runs PBKDF2: timing enumeration remains possible. Both IP and email limits are in-process Maps, reset on cold starts/redeploys, and are unshared across Vercel/edge instances. IP limiting trusts forwarded-IP headers directly; safety depends on an upstream always overwriting them. It also produces shared-NAT false positives and IP rotation bypasses.
- **How verified:** Source inspection. Missing-user branch records and returns; existing-user branch calls `verifyPassword`. Middleware derives key from `x-forwarded-for`/`x-real-ip`; no durable shared store exists. The comments themselves acknowledge reset/multi-instance limitation.
- **Suggested fix:** Use a durable, atomic, shared rate limiter (Redis/Upstash or edge-native product) keyed by trusted platform-provided client IP and normalized account identifier; add sensible per-account and per-IP limits with privacy-aware error handling. Always verify against a fixed dummy PBKDF2 hash for missing users. Raise PBKDF2-SHA512 to a calibrated current baseline (at least current OWASP guidance), with versioned opportunistic rehash. Load-test shared-NAT behavior and spoofed headers behind the actual proxy.

## H-07 — Live public filler error path is broken

- **Location:** live `https://formsv1.vercel.app/f/does-not-exist` (and likely live deployment/config drift).
- **What is wrong:** An unknown slug returns **HTTP 500**, exposing an application failure instead of the source route’s intended `notFound()` response/404.
- **How verified:** Non-destructive `curl -i` on 2026-07-20 returned HTTP/2 500 with Next error output. The audited source calls `notFound()` for a missing form, so live does not demonstrate a healthy handoff state.
- **Suggested fix:** Inspect Vercel function logs/deployment env and redeploy the audited commit after fixing the underlying error. Add live smoke checks for unknown/unpublished/published slugs and alert on 5xx.

## H-08 — TypeScript is not release-clean; the production build hides the failures

- **Location:** project-wide; prominent: `questions/route.ts`, `workspaces/[id]/route.ts`, both fillers, dashboard/builder/responses viewer, websocket examples, and `src/lib/email.ts`.
- **What is wrong:** `tsc --noEmit` returns **28 errors**. The prior worklog’s claim that lint/compile is clean is false. `next build` succeeds because it explicitly skips type validation.
- **How verified:** Fresh clean install then `bunx tsc --noEmit` (exit 2). Counts by file: 10 `questions/route.ts`; 3 `form-builder.tsx`; 3 `responses-viewer.tsx`; 2 each dashboard, slug filler, main filler; and individual errors in workspace route, page, question summary, email, plus two WebSocket missing modules.
- **Suggested fix:** Make `tsc --noEmit` a required CI/build gate; correct type definitions rather than disabling checks. Remove or properly package/type-check demo WebSocket and unused email code.

## H-09 — Prisma/data state is not handoff-ready and contradicts the declared SQLite stack

- **Location:** `prisma/schema.prisma`, root `.env`, tracked `db/custom.db`, `prisma/`.
- **What is wrong:** The schema and committed environment configure PostgreSQL/Supabase, not SQLite. A separate tracked SQLite database exists. There are **no Prisma migration files**, so there is no reproducible migration lineage or reliable drift check. `prisma validate` only validates schema syntax.
- **How verified:** Direct file inspection and read-only `file`/SQLite schema inspection. `find prisma` returned only `schema.prisma`.
- **Suggested fix:** Decide and document the single production database. Remove the stale tracked DB from release source. Create and commit reviewed migrations, run `prisma migrate status` against an approved non-production clone and production under change control, and add a CI migration/drift gate. Never rely on `db push` for handoff production schema management.

## H-10 — Caddyfile is not production-ready even aside from open proxy

- **Location:** `Caddyfile`.
- **What is wrong:** It listens on `:81`, names no production domain, has no explicit TLS/domain policy or security headers, and only suits a generic development transform proxy. This conflicts with the supplied Vercel live URL.
- **How verified:** Direct Caddyfile inspection; live response headers identify `server: Vercel`, not Caddy.
- **Suggested fix:** Either remove Caddy from the delivered architecture and document Vercel, or provide an explicit production Caddy config for the client domain with automatic HTTPS, fixed upstream, headers/CSP as appropriate, logging, health checks, and an operations runbook.

---

# 3. Medium — non-blocking only after Critical/High issues are resolved

## M-01 — Form input validation is mostly client-only and incomplete

- **Location:** `src/components/forms/question-input.tsx`; response validation in `src/lib/validations.ts`.
- **What is wrong:** Email gets a custom client regex, but Phone and Website advance without validation, and Number has HTML min/max only (Enter can advance an out-of-range/manual value). Server response validation only imposes string length; it does not validate required fields, email/URL/date/phone formats, numeric ranges, rating/opinion range, legal acceptance, or selected option membership.
- **How verified:** Inspected all 14 input dispatch cases and their handlers; route accepts `{ questionId, value: string }` only.
- **Suggested fix:** Define server-side type-specific validation from stored question settings; return per-answer errors. Mirror it client-side for user experience. Execute an end-to-end matrix for all 14 types in both filler paths before sign-off.

## M-02 — Unsupported/unused upload and download directories are committed but no server upload handler exists

- **Location:** root `upload/`, `download/`; API route audit.
- **What is wrong:** Four image files are tracked in `upload/` and a `download/README.md` exists, but no server endpoint reads multipart/form data or writes files. Thus there is no demonstrated production file-upload capability, allowlist, content inspection, size limit, or storage policy. The dashboard import is client-side JSON parsing, not a server file upload.
- **How verified:** Searched `src` for multipart, `formData`, filesystem writes, and upload/download paths; no upload API handler found. Enumerated files and all API routes.
- **Suggested fix:** Remove dead artifacts if uploads are out of scope. If uploads are a feature, build a signed-object-storage flow with server-enforced allowlist, byte limit, filename/path normalization, malware scanning where appropriate, authorization, and retention/deletion policy. Test traversal and oversized/polyglot files.

## M-03 — Dead WebSocket demo is wired to the unsafe proxy convention and does not type-check

- **Location:** `examples/websocket/*`, `.zscripts/*`, `Caddyfile`.
- **What is wrong:** The example Socket.IO server uses CORS `origin: "*"`, no authentication, port 3003, and query-controlled Caddy routing. It is not imported by the Next application, and `mini-services` contains only `.gitkeep`, but scripts automatically scan/build/start mini-services when present in some deployment paths. The demo is also missing `socket.io` and `socket.io-client` dependencies, causing two TypeScript errors.
- **How verified:** Import/reference search, file inspection, and `tsc` output. `mini-services` has no actual service source.
- **Suggested fix:** Delete the examples and generic service-start logic from the production repository, or make a separately deployed/authenticated/restricted service with explicit ownership and dependency management.

## M-04 — Builder mobile, dashboard polish, and dark-mode claims were not substantiated

- **Location:** `worklog.md` unresolved risks; `dashboard.tsx`, `form-builder.tsx`, `question-editor.tsx`, `design-panel.tsx`.
- **What is wrong:** The worklog itself lists center preview polish, dashboard hover/loading state, and three-panel mobile layout as unresolved. No browser automation/device evidence exists in this audit, and type failures prevent treating visual runtime behavior as signed off.
- **How verified:** Reviewed the unresolved-risk section and could not perform honest authenticated browser/device testing without a test account/environment.
- **Suggested fix:** After type/security fixes, run documented Playwright (desktop + 375px/768px) visual/accessibility tests for dashboard, builder, public slug filler, and in-app preview in light/dark themes. For the builder, provide a tested mobile panel/drawer pattern rather than relying on three visible panes.

---

# 4. Low — backlog / maintainability

## L-01 — Rate-limit maps can accumulate keys and account lockout behavior is opaque

- **Location:** `src/middleware.ts`, `src/lib/rate-limit.ts`.
- **What is wrong:** Middleware’s Map has no cleanup, and email-rate-limit cleanup assumes a fixed 15-minute maximum. Users do not receive a consistent retry response from NextAuth’s credentials flow; logs include email addresses.
- **How verified:** Source inspection.
- **Suggested fix:** This is naturally resolved by replacing Maps with a managed limiter; otherwise add bounded eviction, structured privacy-safe observability, and user-safe retry feedback.

## L-02 — Generic public `/api` endpoint is unnecessary

- **Location:** `src/app/api/route.ts`.
- **What is wrong:** It exposes only `{ "message": "Hello, world!" }`; not a vulnerability by itself, but it is an undocumented production endpoint.
- **How verified:** Live `GET /api` returned 200 and that JSON; source matches.
- **Suggested fix:** Remove it or convert it to a documented health endpoint with intended cache/auth/monitoring behavior.

## L-03 — Response export was reviewed statically, not end-to-end

- **Location:** `src/components/forms/responses-viewer.tsx`.
- **What is wrong:** CSV generation exists client-side, but type errors in this component and absence of an approved test form mean export fidelity against submitted answers is unproven.
- **How verified:** Source inspection and `tsc` errors at lines reported in this file; no production data altered.
- **Suggested fix:** Add deterministic CSV unit tests (escaping, multiline, commas, Unicode, dates, missing answers) and E2E submit→owner view→download comparison tests.

---

## Findings that were specifically checked and not found in the protected routes

This is not a blanket “everything works” assertion. In a static audit of the named protected paths, the following use a session check plus owner comparison before their principal operation: form get/update/delete/duplicate, questions batch save, direct ending CRUD, response list/delete/summary/delete-all, and workspace get/update/delete. The live anonymous `GET /api/forms` also returned 401.

Exceptions are material and are reported above: bulk form-ending save (C-02), cross-workspace assignment (H-04), and public response/partial paths (C-04). Dynamic two-account IDOR tests still need to be run in an approved test environment.

## Required sign-off test plan after remediation

1. Use isolated test DB and two test users. Execute an endpoint-by-endpoint IDOR suite (including bulk endings, workspace reassignment, response/partial tokens, and cross-form question IDs).
2. Build a published form containing all 14 requested question types; submit valid/invalid boundary data through both filler routes; compare API records and CSV export byte-for-byte/semantically.
3. Test logic with AND/OR, first-match precedence, multiple chained jumps, custom/default endings, redirect URLs, self/cycle rejection, and back navigation.
4. At `maxResponses = 1` and at a near-limit boundary, fire 20 parallel submissions against a dedicated PostgreSQL test database and assert no oversubscription.
5. Abort a form/ending/question save at controlled failure points and assert atomic rollback; test template cloning for no shared IDs/state.
6. Browser-test keyboard-only fill and responsive/dark-mode flows at desktop, 768px, and 375px. Capture artifacts.
7. Run clean `bun install --frozen-lockfile`, `bun run lint`, `bunx tsc --noEmit`, and `bun run build` in CI; require all zero-error results. Confirm migrations against the chosen DB and deploy only after secret rotation/history rewrite.
