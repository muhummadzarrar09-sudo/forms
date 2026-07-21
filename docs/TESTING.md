# Test Environment & Release Evidence

## Safety rule

**Never run integration commands against the client Supabase/PostgreSQL database.** The local/CI integration database is disposable and runs only through `docker-compose.test.yml`.

## Local setup

```bash
cp .env.test.example .env.test
bun install --frozen-lockfile
bun run test:unit
bun run test:db:up
# Install Chromium once per workstation/CI image.
bunx playwright install chromium
# Runs the public response, API-integrity, and concurrency suite.
bun run test:e2e
bun run test:db:down
```

`test:db:up` uses `prisma db push` only for the ephemeral Docker PostgreSQL container. Production must use reviewed, baselined migrations under change control.

## Current automated coverage

| Area | Test file | Status |
| --- | --- | --- |
| conditional logic | `tests/logic-engine.test.ts` | unit coverage active |
| filler navigation | `tests/filler-navigation.test.ts` | unit coverage active |
| filler submission/partial completion | `tests/filler-submission.test.ts` | unit coverage active |

## Required integration/browser matrices

### API/security (two users + anonymous respondent)

- Form/workspace/ending/response IDOR rejection for every protected route.
- Foreign question ID, duplicate answer ID, unpublished form, partial token, and hidden-field metadata behavior.
- 20 simultaneous submissions at `maxResponses = 1` and near-cap boundaries.
- Transaction rollback on aborted form/questions/endings save.

### Form behavior

- All 14 requested input types with valid and invalid values.
- Logic ALL/ANY, precedence, default jump, custom/default ending, invalid target/cycle rejection.
- Template copy isolation and response CSV output match.

### Browser/UI

- Dashboard, builder, in-app preview, and `/f/:slug` at 1440px, 768px, and 375px.
- Light/dark themes, full keyboard-only completion, browser Back/Forward route restoration.
- Accessibility scan (focus order, names, contrast, reduced motion).

## Release gates

A handoff build requires all of the following:

```bash
bun install --frozen-lockfile
bun run test:unit
bun run test:e2e
bunx tsc --noEmit
bun run lint
bun run build
```

plus the integration/browser matrix run against the isolated environment with captured artifacts.
