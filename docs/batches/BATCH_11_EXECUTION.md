# Batch 11 — Browser/API Runtime Evidence Suite

**Completed locally:** 2026-07-21. The suite is implemented and type-checked. It was not run end-to-end because this runtime has no Docker daemon for the disposable PostgreSQL service and no installed Chromium browser.

## Delivered

### Playwright test harness

- Added `@playwright/test`.
- Added `playwright.config.ts` with a test-only PostgreSQL URL, a Webpack dev server on port 3001, trace retention, and failure screenshots.
- Added scripts:
  - `bun run dev:e2e`
  - `bun run test:e2e`
  - `bun run test:integration`
- Changed `bun run test:unit` to explicitly run only `./tests`, so Playwright specs are never accidentally executed through Bun’s unit runner.

### First real end-to-end suite

Added `e2e/public-response.spec.ts`. Against the disposable DB/server, it will test:

1. public `/f/:slug` welcome → input → submit → ending → persisted answer;
2. foreign question-ID rejection on public response API;
3. **20 parallel submissions at `maxResponses = 1`**, expecting exactly 1 HTTP 201 and 19 HTTP 403 responses, plus one completed DB response;
4. anonymous partial-response creation rejection for unpublished forms.

Every test resets the disposable database and creates its own form/owner fixture; no real credentials or production data are required.

## How to run the evidence suite

```bash
cp .env.test.example .env.test
bun install --frozen-lockfile
bun run test:db:up
bunx playwright install chromium
bun run test:e2e
bun run test:db:down
```

## Verification actually run

| Check | Result |
| --- | --- |
| clean `bun install --frozen-lockfile` | passed |
| `bun run test:unit` | 11 passed / 26 assertions |
| `bunx tsc --noEmit` | passed, includes E2E spec types |
| `bun run lint` | passed |
| `bun run build` | passed |
| Docker-backed Playwright execution | blocked in this workspace: no Docker daemon/Chromium; not claimed as passed |

## Batch 12 — next target after the environment is available

Run and expand this suite into the full proof matrix:

- all 14 input types and server validation boundaries;
- two-user authenticated IDOR tests for forms, workspaces, endings, and responses;
- partial-token update/denial behavior;
- logic ALL/ANY/default jump/custom ending/redirect tests;
- autosave transaction rollback and template isolation;
- CSV export accuracy;
- dashboard/builder/filler visual tests at 1440px, 768px, 375px, light/dark;
- keyboard-only and browser Back/Forward route tests.
