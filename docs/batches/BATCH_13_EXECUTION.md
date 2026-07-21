# Batch 13 — Mobile Builder UX & Visual/Accessibility Evidence

**Completed locally:** 2026-07-21. Browser execution awaits the user’s Docker/Chromium confirmation.

## Mobile builder improvement

`FormBuilder` now starts on a small viewport with the settings inspector **closed**, keeping the question canvas usable instead of opening a fixed 280px drawer over it on first paint.

- At `>= 1024px`, the inspector automatically opens as the normal desktop third panel.
- At smaller widths, it remains an explicit drawer opened from the settings control.
- Added accessible labels to the icon-only Back, question-list, and settings drawer controls.
- Existing mobile right-drawer backdrop continues to close the inspector on outside click.

## Visual/interaction test implementation

Added `e2e/ux-accessibility.spec.ts` with two browser tests:

1. **Mobile dark public filler**
   - 375px viewport;
   - dark form theme;
   - keyboard input/Enter completion;
   - ending screen and themed background assertion;
   - screenshot artifact.

2. **Mobile builder focus/drawer**
   - 375px authenticated creator viewport;
   - confirms settings drawer begins closed;
   - opens it via accessible label;
   - asserts no horizontal overflow;
   - captures screenshot artifact.

## Verification actually run

| Check | Result |
| --- | --- |
| clean `bun install --frozen-lockfile` | passed |
| `bun run test:unit` | 11 passed / 26 assertions |
| `bunx tsc --noEmit` | passed, including browser specs |
| `bun run lint` | passed |
| `bun run build` | passed |
| Docker/Chromium browser execution | awaiting environment confirmation; not claimed as passed |

## What remains after Chromium confirmation

Run `bun run test:db:up`, install Chromium, and run the Playwright suite. Then fix any evidence-driven failures, extend screenshots to tablet/desktop/dashboard/responses and dark mode, and complete CSV/template/autosave rollback browser/API evidence before final handoff.
