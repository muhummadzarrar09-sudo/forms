# Batch 8 — Shared Filler Question Presentation

**Completed locally:** 2026-07-21. No production deployment or data write was performed.

## Delivered

Extracted the duplicated question-screen UI from both filler routes into:

```text
src/components/forms/filler-question-screen.tsx
```

Both the public slug filler and in-app filler now render the same component for:

- question number and required indicator;
- title and description layout;
- themed QuestionInput rendering;
- font/theme presentation;
- required-answer feedback animation.

The shared component relies on the shared required-answer semantics from Batch 7, so required Legal questions correctly require explicit consent in both routes.

## Why this extraction is safe

The extraction is presentational plus the already-tested required guard. It does not change route-specific behavior:

- public slug loading and response path remain public-route specific;
- in-app unpublished preview remains non-persisting;
- partial response lifecycle remains in the in-app share route;
- header/footer/close controls remain route-specific.

This removes another large duplicated surface without forcing incompatible route shells into one component.

## Verification actually run

| Check | Result |
| --- | --- |
| clean `bun install --frozen-lockfile` | passed |
| `bun test` | 11 passed / 26 assertions |
| `bunx tsc --noEmit` | passed, exit 0 |
| `bun run lint` | passed, exit 0 |
| `bun run build` | passed, exit 0 |

## Remaining filler work

The shared behavior/presentation core now covers logic, navigation, submission, question screen, validation hints, hidden fields, and partial completion. Remaining deliberate duplication is largely shell-level: confetti, keyboard listener, theme-screen layout, route loading, and creator-only chrome. Browser E2E tests should precede any final shell merge.
