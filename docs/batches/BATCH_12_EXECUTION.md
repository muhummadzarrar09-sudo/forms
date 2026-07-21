# Batch 12 — Expanded Runtime Proof Matrix

**Completed locally:** 2026-07-21. Runtime E2E execution remains blocked by unavailable Docker/Chromium in this workspace; this batch implements and type-checks the expanded suite rather than falsely claiming a pass.

## Delivered

Added `e2e/ownership-and-validation.spec.ts` to the Playwright suite.

### Test cases implemented

1. **All 14 supported input types**
   - creates a published fixture containing ShortText, LongText, MultipleChoice, PictureChoice, Dropdown, YesNo, Email, Phone, Number, Website, Date, Rating, OpinionScale, and Legal;
   - submits a valid anonymous response;
   - asserts 201 and all 14 persisted answers.

2. **Server-side validation**
   - submits invalid email data;
   - asserts HTTP 400 and a validation error.

3. **Two-user IDOR denial**
   - creates attacker and victim users;
   - creates a victim form, custom ending, and workspace;
   - creates a signed test-only NextAuth session for the attacker;
   - asserts attacker receives 403 attempting form, ending, and workspace updates;
   - verifies victim records are unchanged.

The existing public-response suite continues to cover public response persistence, cross-form answer injection rejection, 20-way response-cap contention, and unpublished partial creation denial.

## Verification actually run

| Check | Result |
| --- | --- |
| clean `bun install --frozen-lockfile` | passed |
| `bun run test:unit` | 11 passed / 26 assertions |
| `bunx tsc --noEmit` | passed, including all Playwright specs |
| `bun run lint` | passed |
| `bun run build` | passed |
| Docker + Chromium E2E execution | blocked by environment; not claimed as passed |

## Required next execution command

On a machine/CI runner with Docker available:

```bash
bun run test:db:up
bunx playwright install chromium
bun run test:e2e
bun run test:db:down
```

## Next batch after actual E2E run

Use the failing/passing evidence to complete the visual/accessibility layer: mobile 3-panel builder, dashboard/builder/filler dark-mode snapshots, keyboard-only paths, Back/Forward browser routing, custom/default endings and redirects, CSV export, templates, and save-abort transaction behavior.
