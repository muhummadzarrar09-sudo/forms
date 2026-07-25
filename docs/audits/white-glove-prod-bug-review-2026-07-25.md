# White-glove production bug review — Forms

**Date:** 2026-07-25  
**Branch reviewed:** `arena/019f9405-forms`  
**Review type:** white-box code review, production-readiness audit, security/data-integrity pass, Lighthouse-style quality pass.

> No review can honestly guarantee discovery of every future production bug. This report is the deepest deterministic pass I could perform from the repository state: source inspection, route tracing, data-flow review, build/lint/type/test execution, dependency audit, and attempted Lighthouse execution.

---

## Executive verdict

**Not production-ready.** The codebase has good UX foundations and several important remediations already in place, but current production release should be blocked until the P0/P1 items below are fixed.

Primary blockers:

1. **Install/build quality gates fail**: npm install has a dependency conflict; TypeScript fails; ESLint fails; `next build` fails in this environment; Next is configured to ignore TypeScript build errors.
2. **Public response integrity is not enforced server-side**: required questions can be bypassed by direct API calls, and partial-response completion can bypass response caps and close dates.
3. **Public/private boundary is leaky/inconsistent**: published form fetches expose owner/workspace metadata and legacy public links break for logged-in non-owners.
4. **Analytics are wrong for choice questions** because stored option IDs are counted against option labels.
5. **Embed promise is broken in the Caddy production path** because the project offers iframe embed code while Caddy emits `X-Frame-Options: SAMEORIGIN`.
6. **Auth/rate limiting is not production-grade**: the dummy PBKDF2 path is declared but not used, and rate limiting is process-local.
7. **Deployment artifacts are stale/mismatched**: scripts reference a hard-coded path and packaged SQLite DB while Prisma schema is PostgreSQL.

---

## Verification commands run

| Check | Result | Notes |
| --- | --- | --- |
| `npm install` | **Fail** | `ERESOLVE` conflict: root `nodemailer@^9.0.3` vs `next-auth@4.24.x` peerOptional `nodemailer@^7.0.7`. |
| `npm install --legacy-peer-deps` | **Fail** | Continued far enough to install most modules, then `postinstall` failed while `prisma generate` attempted to fetch Prisma engines. Removed generated `package-lock.json` afterward. |
| `npx bun test ./tests` | **Pass** | 13 unit tests passed. |
| `npm run lint` | **Fail** | 10 React lint errors, mostly static component creation and set-state-in-effect. |
| `npx tsc --noEmit` | **Fail** | 6 TS2339 errors in `src/app/api/forms/[id]/responses/route.ts`. |
| `npm run build` with dummy env | **Fail** | Turbopack/`next/font` failed to fetch Geist fonts from Google. Dev mode falls back; production build fails. |
| `npx prisma validate` | **Fail** | Prisma schema-engine download failed in this sandbox. CI needs deterministic engine availability/cache. |
| `npm audit --omit=dev --json` | **Fail** | 10 prod vulnerabilities: 4 high, 6 moderate. |
| Lighthouse | **Blocked** | Dev server returned `/` 200, but Lighthouse could not run because no Chrome/Chromium executable is installed. Also a production build is currently unavailable. |
| E2E/Playwright | **Blocked** | Docker is not available for the test Postgres service; Chrome/Chromium is not available. |

---

## Release-blocking findings

### P0-01 — Production install/build gates are failing

**Evidence**

- `package.json` uses `postinstall: prisma generate` and no `packageManager` declaration (`package.json:5-22`).
- Dependency conflict: `next-auth` expects optional `nodemailer@^7.0.7`, while the app pins `nodemailer@^9.0.3` (`package.json:70-75`).
- TypeScript build errors are ignored in production config (`next.config.ts:5-6`).
- `npx tsc --noEmit` fails on response scoring code at `src/app/api/forms/[id]/responses/route.ts:293-294`, `388-389`, `537-538`.
- `next build` fails when Google font fetches fail from `src/app/layout.tsx:2-16`.

**Production impact**

A clean deployment may fail before serving traffic, or deploy while masking real type errors. The app currently depends on successful external font and Prisma engine downloads during build/install.

**Fix direction**

- Add an explicit package manager, e.g. `"packageManager": "bun@1.3.x"`, or add a committed npm/pnpm lock and make npm install clean.
- Align or remove `nodemailer`; `src/lib/email.ts` appears unused.
- Remove `typescript.ignoreBuildErrors` and fix the TypeScript errors.
- Self-host fonts or use local fallback fonts so production builds are network-independent.
- Cache/pin Prisma engines in CI or ensure install has network access.

---

### P0-02 — Server accepts incomplete required responses

**Evidence**

- `submitResponseSchema` only requires at least one supplied answer, not all required answers (`src/lib/validations.ts:128-139`).
- `validateAnswerValues` explicitly skips empty answers and says requiredness is handled in client navigation (`src/app/api/forms/[id]/responses/route.ts:45-56`).
- `answersBelongToForm` validates only supplied question IDs and cannot detect omitted required questions (`src/app/api/forms/[id]/responses/route.ts:33-42`).

**Production impact**

Any respondent or bot can POST directly to `/api/forms/:id/responses` with missing or empty required fields. Required legal consent can be omitted entirely. This compromises response data and any compliance assumption attached to legal questions.

**Fix direction**

Server-side submission validation must derive required questions from the form and reject missing/blank answers. For conditional logic, validate the computed visible path or persist a server-verifiable path/step model.

---

### P0-03 — Partial response completion bypasses response caps and close dates

**Evidence**

- Full POST submissions enforce `closeDate`, advisory lock, and `maxResponses` (`src/app/api/forms/[id]/responses/route.ts:370-417`).
- Partial creation only checks form existence/published and does not enforce close date or response cap (`src/app/api/forms/[id]/responses/route.ts:266-339`).
- Partial PUT can set `isPartial: false` and `completedAt` without the advisory lock, cap check, or close-date check (`src/app/api/forms/[id]/responses/route.ts:505-597`).
- Legacy/in-app public filler creates a partial as soon as a respondent starts (`src/components/forms/form-filler.tsx:427-452`) and completes it via PUT through `submitFillerResponse` (`src/lib/filler-submission.ts:23-45`).

**Production impact**

Forms with `maxResponses` or `closeDate` can still receive completed responses through the partial-response path. This is especially likely for legacy `?form=:id` links and any forms without a slug.

**Fix direction**

When a partial is completed, run the same transaction/advisory lock/cap/close-date enforcement as full POST. Consider deleting/stopping partial creation after close/cap. Add E2E coverage for completing a partial after cap/close.

---

### P0-04 — Public iframe embed is blocked by production Caddy config

**Evidence**

- Share dialog generates an iframe embed code (`src/components/forms/share-dialog.tsx:47-54`).
- Caddy emits `X-Frame-Options "SAMEORIGIN"` (`Caddyfile:15-18`).

**Production impact**

The advertised embed code will be blocked by browsers on external sites when deployed behind this Caddyfile.

**Fix direction**

Replace `X-Frame-Options` with a deliberate CSP `frame-ancestors` strategy. If public embedding is a feature, allow configured origins or omit frame blocking for `/f/*` while protecting creator/admin pages.

---

## High-priority security and data findings

### P1-01 — Public form responses expose private owner/workspace metadata

**Evidence**

- Unauthenticated users can fetch a published form by ID and receive `serializeForm(form)` (`src/app/api/forms/[id]/route.ts:73-78`).
- `serializeForm` includes all form fields plus `userId`, `workspaceId`, and serialized workspace (`src/lib/api-serialization.ts:153-166`; raw shape includes `userId` and `workspace` at `src/lib/api-serialization.ts:70-77`).
- `/f/:slug` serializes the same full form into the public client component (`src/app/f/[slug]/page.tsx:74-88`).

**Impact**

Public respondents can inspect owner IDs and workspace metadata that are not needed to fill the form. Hidden field definitions/defaults are also sent to the browser.

**Fix direction**

Create a `serializePublicForm` that returns only respondent-required fields: public form settings, questions, endings, hidden field names/defaults if truly needed. Exclude `userId`, workspace, archived/favorite/tags unless intentionally public.

---

### P1-02 — Logged-in non-owners are blocked from published legacy form links

**Evidence**

`GET /api/forms/[id]` returns `403` for any authenticated non-owner before checking whether the form is published (`src/app/api/forms/[id]/route.ts:60-78`). Legacy `?form=:id` links still use this API through `FormFiller`.

**Impact**

If a respondent is signed in as another account and opens a public legacy ID link, they receive a failure even when the form is published.

**Fix direction**

Return a public serializer for published forms to everyone. Return full private serializer only to the owner. Drafts should remain owner-only.

---

### P1-03 — Auth dummy hash is declared but not used

**Evidence**

- `DUMMY_PASSWORD_HASH` exists for timing equalization (`src/lib/auth.ts:7-9`).
- Missing users return immediately after recording the rate-limit attempt (`src/lib/auth.ts:35-40`).
- Only existing users run `verifyPassword` (`src/lib/auth.ts:43-48`).

**Impact**

Login timing can still distinguish missing users from wrong-password users, contrary to the comments and prior audit notes.

**Fix direction**

Always call `verifyPassword(credentials.password, user?.password ?? DUMMY_PASSWORD_HASH)` before returning, then branch on `user && passwordMatch`.

---

### P1-04 — Rate limiting is process-local and insufficient for production

**Evidence**

- `src/lib/rate-limit.ts:4-8` explicitly warns in-memory state resets and is not shared across instances.
- Middleware also uses an in-memory `Map` (`src/middleware.ts:3-8`).

**Impact**

Multi-instance/serverless deployments can be brute-forced by instance rotation/cold starts. Public response endpoints have no comparable anti-spam limit.

**Fix direction**

Use Redis/Upstash or database-backed rate limiting keyed by IP+email/form, and add public response submission limits/bot controls.

---

### P1-05 — Ending redirect URLs are unvalidated and can become unsafe links

**Evidence**

- Ending create/update accepts `body.redirectUrl` without schema or protocol checks (`src/app/api/forms/[id]/endings/route.ts:78-85`, `src/app/api/forms/[id]/endings/[endingId]/route.ts:44-52`).
- Filler renders that value directly as `href` (`src/components/forms/form-filler.tsx:835-853`, `src/app/f/[slug]/slug-form-filler.tsx:429-437`).

**Impact**

A malicious or compromised creator can create `javascript:`/`data:`/phishing links shown to respondents. At minimum this is a respondent safety issue.

**Fix direction**

Validate redirect URLs server-side with `new URL`, allow only `https:` and optionally `http:` for local/dev. Consider showing the destination host in UI.

---

### P1-06 — CSV export is vulnerable to spreadsheet formula injection

**Evidence**

CSV export writes raw respondent values and question titles into CSV without formula neutralization; headers are not escaped either (`src/components/forms/responses-viewer.tsx:259-281`).

**Impact**

If a respondent submits `=HYPERLINK(...)`, `+cmd`, `@SUM(...)`, etc., opening the CSV in spreadsheet software can execute formulas or exfiltrate data.

**Fix direction**

Escape every cell, including headers, and prefix dangerous leading characters (`=`, `+`, `-`, `@`, tab, CR) with a single quote or other approved neutralizer.

---

## High-priority functional correctness findings

### P1-07 — Choice-question analytics count option IDs as labels

**Evidence**

- Response validation requires selected choice values to match `option.id` (`src/app/api/forms/[id]/responses/route.ts:84-87`).
- Summary initializes `choiceCounts` with `opt.label`, then increments using raw stored `a.value` (`src/app/api/forms/[id]/responses/summary/route.ts:73-87`).

**Impact**

Choice summaries show zeroes for real labels and separate counts under internal IDs like `choice-a`. Creator analytics are incorrect.

**Fix direction**

Build `id -> label` maps and split multi-select values before counting. Store/export display labels separately from IDs.

---

### P1-08 — Response and analytics APIs are unpaginated and load all answers

**Evidence**

- Response listing fetches all responses and all answers, then filters in memory (`src/app/api/forms/[id]/responses/route.ts:141-165`).
- Summary fetches the entire form, every response, and every answer (`src/app/api/forms/[id]/responses/summary/route.ts:20-30`).

**Impact**

Large or spammed forms will time out or exhaust memory. Search/date filters are also not fully database-side.

**Fix direction**

Add pagination and query-level filters to response list. For summaries, aggregate in SQL/Prisma grouped queries or materialize rollups.

---

### P1-09 — Date filters can turn bad input into 500s

**Evidence**

`startDate`/`endDate` are passed through `new Date(...)` without validity checks before being used in Prisma filters (`src/app/api/forms/[id]/responses/route.ts:123-138`).

**Impact**

Malformed query strings can trigger server errors instead of `400` validation responses.

**Fix direction**

Validate dates with Zod/refinement or explicit `Number.isNaN(date.getTime())` checks.

---

### P1-10 — Question type is free-form despite the app expecting an enum

**Evidence**

- Prisma stores `Question.type` as plain `String` (`prisma/schema.prisma:75-79`).
- API save schema accepts `type: z.string().max(30)` (`src/lib/validations.ts:106-118`).

**Impact**

Invalid question types can be persisted by import/API calls and then break filler rendering, validation, analytics, and logic assumptions.

**Fix direction**

Use a shared `z.enum([...])` matching `QuestionType`; consider a Prisma enum or database check constraint.

---

### P1-11 — Show-score behavior is inconsistent and does not honor `FormEnding.showScore`

**Evidence**

- `FormEnding.showScore` exists in schema (`prisma/schema.prisma:119-126`).
- Legacy filler shows score whenever `totalScore > 0`, regardless of the ending's `showScore` flag (`src/components/forms/form-filler.tsx:856-869`).
- Slug filler has no equivalent score calculation/display path (`src/app/f/[slug]/slug-form-filler.tsx:90-237`, `390-455`).

**Impact**

Creators cannot reliably control score disclosure. Respondents on `/f/:slug` and legacy preview can see different behavior.

**Fix direction**

Centralize filler state/rendering and display score only when the active/default ending opts in.

---

## Production deployment findings

### P2-01 — Deployment scripts are stale and inconsistent with PostgreSQL

**Evidence**

- `.zscripts/build.sh` uses hard-coded `/home/z/my-project` and packages `db/custom.db` (`.zscripts/build.sh:12-18`, `80-93`).
- Prisma datasource is PostgreSQL (`prisma/schema.prisma:5-9`).
- `.zscripts/start.sh` defaults `DATABASE_URL` to `file:/app/db/custom.db` and runs `bun server.js` (`.zscripts/start.sh:56-83`).
- `package.json` production start uses Node standalone output (`package.json:7-8`).

**Impact**

The repository contains two incompatible production stories: Vercel/Postgres docs vs custom Caddy/SQLite/Bun scripts. A team following the wrong path will ship a broken or data-losing deployment.

**Fix direction**

Delete or quarantine stale `.zscripts`, or update them to match the documented Postgres deployment. Ensure one canonical production runbook.

---

### P2-02 — No baseline Prisma migration for full schema

**Evidence**

Only one migration exists for `editToken`; docs say fresh deployment must use `prisma db push` because no historical baseline migration exists (`docs/DEPLOYMENT.md:20-31`).

**Impact**

`prisma migrate deploy` cannot initialize production from scratch in a controlled, auditable way.

**Fix direction**

Create a baseline migration matching current schema, then migrate forward normally.

---

### P2-03 — Custom production domain is ignored for OG metadata when `VERCEL_URL` exists

**Evidence**

`getBaseUrl` checks `VERCEL_URL` before `NEXT_PUBLIC_APP_URL`, despite the comment saying explicit override wins (`src/app/f/[slug]/page.tsx:11-16`). Sitemap uses the opposite order (`src/app/sitemap.ts:8-12`).

**Impact**

OpenGraph URLs/images can point at a Vercel preview/deployment hostname instead of the canonical custom domain.

**Fix direction**

Prefer `NEXT_PUBLIC_APP_URL`, then `VERCEL_URL`, then localhost. Add tests.

---

## UI/UX/accessibility findings

### P2-04 — `allowBackNavigation` can be bypassed with keyboard shortcuts

**Evidence**

- Back button rendering checks `allowBackNavigation` (`src/components/forms/form-filler.tsx:907-925`, `src/app/f/[slug]/slug-form-filler.tsx:493-510`).
- Keyboard handler always calls `onBack` for Backspace and Alt+Left (`src/components/forms/filler-shell.tsx:8-30`).
- Keyboard hint always advertises Backspace to go back (`src/components/forms/form-filler.tsx:984-996`, `src/app/f/[slug]/slug-form-filler.tsx:565-577`).

**Impact**

A creator setting is not enforced, and respondents can move backward even when the UI hides the back button.

**Fix direction**

Pass `canGoBack` into `useFillerKeyboardNavigation` and conditionally render hints.

---

### P2-05 — Back navigation ignores conditional/logic path history

**Evidence**

Both fillers implement back as `currentIndex - 1` or last question from ending (`src/components/forms/form-filler.tsx:332-349`, `src/app/f/[slug]/slug-form-filler.tsx:208-225`). Forward navigation can skip questions via logic/visibility (`src/lib/filler-navigation.ts:33-53`).

**Impact**

Back can reveal skipped/hidden questions or land on a question the respondent never saw.

**Fix direction**

Maintain an actual navigation history stack and pop it on back.

---

### P2-06 — User-selected colors are only syntactically validated, not contrast-validated

**Evidence**

Color schemas only require hex format (`src/lib/validations.ts:15`, `46-65`, `71-100`). The filler applies colors directly as background/text/button colors.

**Impact**

Creators can publish unreadable forms that fail WCAG contrast/Lighthouse accessibility.

**Fix direction**

Warn or block low-contrast theme combinations; at minimum provide auto-correct suggestions.

---

### P2-07 — Duplicate filler implementations are already diverging

**Evidence**

There is a legacy/app filler (`src/components/forms/form-filler.tsx`) and a slug filler (`src/app/f/[slug]/slug-form-filler.tsx`) with duplicated navigation/rendering logic. The legacy path has partial autosave and scoring state; the slug path does not.

**Impact**

Fixes and features will drift. Some production respondents will see different behavior depending on link shape.

**Fix direction**

Extract a single shared filler state machine/component used by both shell contexts.

---

## Code-quality/tooling findings

### P2-08 — ESLint rules are heavily disabled, masking real bugs

**Evidence**

`react-hooks/exhaustive-deps`, TypeScript no-explicit-any, no-console, no-debugger, no-empty, no-unreachable, etc. are disabled (`eslint.config.mjs:10-40`).

**Example consequence**

`handleCreateForm` uses `newFormWorkspaceId` but omits it from the dependency array (`src/components/forms/dashboard.tsx:515-606`). Depending on interaction order, new forms can be created in the wrong workspace.

**Fix direction**

Re-enable core safety rules gradually. Start with `react-hooks/exhaustive-deps`, no-debugger, no-unreachable, no-empty, and TypeScript unused checks.

---

### P2-09 — Current lint failures should be fixed, not suppressed

**Evidence**

`npm run lint` reports 10 errors:

- `src/components/forms/dashboard.tsx:215`
- `src/components/forms/form-card.tsx:556`, `561`, `647`, `776`, `871`, `949`, `954`
- `src/components/ui/carousel.tsx:98`
- `src/hooks/use-mobile.ts:14`

**Impact**

React 19/static-components and effect-state warnings point to performance/state-reset issues.

**Fix direction**

Move inline components out of render or convert them to functions that are invoked rather than component types, and address state-in-effect patterns with initial state or layout-safe guards.

---

### P2-10 — Dependency surface includes unused vulnerable packages

**Evidence**

`npm audit --omit=dev` found 10 production vulnerabilities, including high severity advisories in `postcss`, `sharp`, and `js-yaml`. Search found no source imports for `@mdxeditor/editor`, `react-syntax-highlighter`, `next-intl`, or `bcryptjs`.

**Impact**

Unused dependencies increase install time, bundle risk, and vulnerability count.

**Fix direction**

Remove unused dependencies, upgrade `sharp`, address Next/PostCSS advisory path with patched Next release when available, and upgrade/remove MDX/syntax-highlighting packages.

---

## Lower-priority observations

- Public `/api/route.ts` returns `Hello, world!`; harmless, but remove if not needed.
- Registration only requires 6-character passwords and returns `409` for existing emails (`src/app/api/auth/register/route.ts:15-49`). This may be acceptable for a personal app but is weak for SaaS.
- Response list numbers use `responses.length - index` after filtering, so displayed numbering can be confusing when filters are active (`src/components/forms/responses-viewer.tsx:224-244`).
- Public share fallback still creates `?form=:id` links in the responses empty-state CTA (`src/components/forms/responses-viewer.tsx:516-523`), while docs say new links should use `/f/:slug`.
- `reactStrictMode` is disabled (`next.config.ts:8`), reducing development detection of side effects.
- `allowedDevOrigins` includes a public IP (`next.config.ts:9-13`); keep dev-only configuration out of production config if possible.

---

## Recommended remediation order

1. **Make CI deterministic:** package-manager declaration, clean install, no TypeScript ignore, local fonts, Prisma engine strategy.
2. **Fix response API correctness:** required answers, partial completion cap/close-date enforcement, public rate limiting, tests.
3. **Split public/private serializers:** published form public response only; owner-only full data.
4. **Fix analytics counts and pagination:** choice ID-to-label mapping, multi-select splitting, response pagination, summary aggregation.
5. **Fix embed/redirect safety:** Caddy frame policy, redirect URL validation.
6. **Unify filler implementation:** shared navigation history, back setting enforcement, consistent scoring and partial behavior.
7. **Clean deployment/docs:** remove stale SQLite/Bun scripts or align them with Postgres/Vercel.
8. **Dependency and lint cleanup:** remove unused vulnerable packages, upgrade advisories, re-enable key lint rules.

---

## Suggested regression tests to add

- Direct API POST missing a required text answer returns `400`.
- Direct API POST omitting required legal consent returns `400`.
- Completing a partial after `maxResponses` is reached returns `403`.
- Completing a partial after `closeDate` returns `403`.
- Published form GET as authenticated non-owner returns public payload, not `403`, and excludes owner/workspace fields.
- Choice analytics counts option IDs under labels correctly, including multi-select values.
- CSV export neutralizes formulas and escapes headers.
- `allowBackNavigation=false` disables Backspace/Alt+Left and hides back hints.
- Conditional logic back navigation returns to the actual previous visible question.
- Caddy/headers test verifies external iframe embedding behavior for `/f/*` matches product decision.
