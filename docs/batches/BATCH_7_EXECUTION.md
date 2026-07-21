# Batch 7 — Shared Filler Navigation Controller

**Completed locally:** 2026-07-21. No production deployment or data change was performed.

## Scope and rationale

This is the next safe extraction after shared logic evaluation and submission. Rather than merge two large UI components, it moves deterministic respondent-flow behavior into one pure, tested module while preserving intentionally different public/preview shells.

## Delivered

### Shared navigation module

Added `src/lib/filler-navigation.ts`, now used by both fillers for:

- deriving the ordered list of fillable questions without mutating the original form;
- selecting the current question from index state;
- required-answer guard;
- legal consent guard (`false` no longer satisfies a required Legal question merely because it is non-empty);
- first-match logic/default jump/submit/custom-ending next-step resolution;
- progress calculation.

The public slug filler and in-app filler no longer keep separate copies of those behaviors. They retain only route-specific responsibilities: loading, preview/draft policy, partial-save behavior, and visual chrome.

### Regression caught and fixed while testing

The initial shared controller incorrectly advanced past the last question to a nonexistent index when no logic rule matched. The navigation test exposed it; final behavior correctly submits at the final question while still honoring a final-question custom ending.

### Tests

Added `tests/filler-navigation.test.ts` covering:

- ending pseudo-question filtering and input immutability;
- required Legal consent semantics;
- logic jump before default advance;
- final-question submit behavior;
- custom ending behavior;
- progress calculation.

## Verification actually run

| Check | Result |
| --- | --- |
| `bun test` | 11 passed / 26 assertions |
| `bunx tsc --noEmit` | passed, exit 0 |
| `bun run lint` | passed, exit 0 |
| `bun run build` | passed, exit 0 |

## Current remaining filler duplication

The route components still intentionally own their distinct visual/loading layers. Remaining candidates for a later, carefully tested UI extraction are confetti, question-screen rendering, keyboard listener, theme presentation, and screen layout. The highest-risk behavioral layers—logic evaluation, navigation calculation, submission, hidden fields, and partial completion—are now shared utilities with unit coverage.
