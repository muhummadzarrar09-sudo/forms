# Follow-up: public-form client exception investigation

**Date:** 2026-07-25  
**Branch:** `arena/019f9405-forms`

## What I checked

The reported symptom was: after making a form public, the public form can show a generic client-side exception. I re-reviewed the publish/share/public-filler path and hardened the areas most likely to turn malformed or legacy form data into a browser crash.

Relevant path reviewed:

- Builder/dashboard publish controls
- `ShareDialog`
- legacy public `?form=:id` filler
- slug public `/f/:slug` filler
- form/question API serialization
- public response submission/update APIs
- response summary analytics

## Fixes applied

### 1. Public filler no longer assumes every question has a valid `settings` object

`QuestionInput` directly accessed `question.settings.allowMultiple`, `question.settings.steps`, etc. If a legacy/imported/public payload had missing settings, that would throw in the client.

Changed to safe defaults for:

- multiple choice
- picture choice
- number
- rating
- opinion scale
- legal

Also made conditional visibility use `question.settings?.visibility`.

### 2. API serialization is now defensive

`serializeQuestion` previously used raw `JSON.parse` for `options`, `imageUrls`, `settings`, and `logic`. Bad/legacy JSON could bubble into client crashes or server 500s.

Now it:

- safely parses JSON with fallbacks;
- normalizes old string-array options into `{ id, label }` objects;
- filters invalid image URLs to strings;
- ensures `settings` is an object;
- ensures `logic` is an array;
- safely parses form tags/hidden fields and response metadata.

### 3. Logic engine no longer crashes on malformed rules

Malformed legacy logic conditions can no longer destructure `undefined` and crash. Invalid rules simply do not match.

### 4. Public `/f/:slug` now has a route-level error UI

Added `src/app/f/[slug]/error.tsx`, so if a public form still hits an unexpected render/runtime error, respondents see a friendly retry screen instead of the generic Next.js client exception page.

### 5. Share/publish dialog no longer double-toggles publish state

`ShareDialog` was doing its own publish API write and then calling the parent publish handler, causing duplicate writes and bypassing builder-only checks such as asset-placeholder warnings.

Now, when a parent publish handler exists, the dialog delegates to it instead of performing a second independent toggle.

### 6. Authenticated non-owners can open published legacy links

`GET /api/forms/:id` previously returned `403` for any signed-in non-owner even if the form was published. That breaks legacy public `?form=:id` links for users who are logged into another account.

Now:

- owner gets the full form;
- everyone else can read published forms;
- drafts remain protected;
- public payloads use a public serializer that strips real owner/workspace fields.

### 7. Canonical public URLs prefer the production custom domain

`/f/:slug` OpenGraph metadata now prefers `NEXT_PUBLIC_APP_URL` before `VERCEL_URL`, matching sitemap behavior and avoiding preview-domain OG URLs in production.

### 8. Response submission integrity fixes added while checking related issues

- Full submissions now reject missing required answers server-side while respecting visibility and conditional jump paths.
- Partial-response completion now validates required answers using merged saved+incoming answers and the same visible/logic path model.
- Partial-response creation/completion now respects `closeDate` and `maxResponses`.
- Partial completion uses the same advisory-lock response-cap pattern as full submission.

### 9. Choice analytics now count labels correctly

Choice answers are stored as option IDs, but summary analytics were counting them against labels. The summary now maps option IDs back to labels and splits multi-select values.

### 10. React lint blockers cleared

Fixed the remaining React lint failures by:

- replacing render-time nested JSX component declarations in `FormCard` with render helper calls;
- switching dashboard hydration detection to `useSyncExternalStore`;
- making the carousel's initial `onSelect` deferred instead of synchronously setting state from an effect;
- rewriting the mobile breakpoint hook with `useSyncExternalStore`.

### 11. Production build no longer depends on Google Fonts fetches

Removed `next/font/google` usage from the root layout and added system font fallbacks in CSS variables. This removes the production-build failure mode where a blocked Google Fonts request breaks `next build`.

### 12. TypeScript build errors are no longer ignored

Removed `typescript.ignoreBuildErrors` and re-enabled `reactStrictMode` in `next.config.ts`.

### 13. Next 16 proxy convention adopted

Renamed the auth rate-limit file from `src/middleware.ts` to `src/proxy.ts` and exported `proxy`, removing the Next 16 deprecation warning while keeping the same matcher behavior.

## Verification after fixes

| Command | Result |
| --- | --- |
| `npx bun test ./tests` | Pass — 13/13 |
| `npm run lint` | Pass |
| `git diff --check` | Pass |
| `next build` | Compiles successfully after removing network-fetched Google fonts, then stops at TypeScript because this sandbox cannot run `prisma generate` / generate `@prisma/client` due Prisma engine download failures. |

## Remaining things to verify in a real browser/DB environment

I could not run Playwright/Lighthouse end-to-end here because this sandbox lacks Docker and Chrome/Chromium. The next verification should be:

1. Create a form with all question types.
2. Publish it from builder header and from share dialog.
3. Open `/f/:slug` signed out.
4. Open legacy `?form=:id` signed out and signed into a different account.
5. Submit valid/invalid responses.
6. Confirm no browser console exception.
7. Confirm response caps and close dates reject both full and partial completion paths.
