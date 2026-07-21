# Batch 6 — Shared Filler Submission Boundary

**Completed locally:** 2026-07-20. No production data was written.

## Why this was scoped before a full filler merge

The public slug filler and in-app filler still differ substantially in loading, draft-preview, navigation chrome, scoring, and partial-response behavior. A one-pass merge would be high risk. This batch extracts the highest-risk shared behavior first: response request construction, API error handling, hidden-field metadata, and partial completion.

## Delivered

### Shared submission primitive

Added `src/lib/filler-submission.ts` and switched both filler routes to it.

It now owns:

- answer serialization;
- correct URL encoding of form IDs;
- hidden-field metadata payload construction;
- normalized API/network errors;
- completed-response POSTs;
- secure partial-response completion PUTs.

The in-app filler retains its intentional draft-preview behavior: unpublished previews show an ending without creating production data. The public slug filler always uses the live submission path.

### Custom-ending integrity fix

The in-app custom-ending flow previously ignored failed submissions and displayed the success ending anyway. It now uses the shared helper and shows an error instead of falsely confirming a failed response.

### Partial-response completion fix

The in-app share flow previously created a partial response, then submitted a separate completed response—leaving the abandoned partial behind and double-counting analytics/caps. It now completes the existing partial via its required `responseId` + `editToken` and marks it non-partial.

`Submit another response` now resets the in-memory partial reference so the next respondent can receive a fresh draft token.

## Tests added

`tests/filler-submission.test.ts` verifies:

1. normal submission is a POST with correct encoded form URL and hidden-field metadata;
2. a partial is completed with PUT/token rather than a duplicate POST;
3. rejected API responses become safe respondent-facing errors.

## Verification actually run

| Check | Result |
| --- | --- |
| `bun test` | 7 passed / 16 assertions |
| `bunx tsc --noEmit` | passed, exit 0 |
| `bun run lint` | passed, exit 0 |
| `bun run build` | passed, exit 0 |
| `git diff --check` | passed |

## Next controlled extraction

The next filler step should extract the shared **state/navigation controller** (current question, answer ref, required guard, logic-action resolution, progress, and keyboard navigation), while keeping visual shells as thin public/preview adapters. That requires a UI interaction test suite first or in the same batch; submission behavior is now protected by a shared tested boundary.
