# UI/UX Audit — Typeform-like Revival Baseline

**Method:** source/layout review and existing local visual artifacts only. This is deliberately not presented as browser/device sign-off: the app currently has 28 TypeScript errors and no authenticated test environment was supplied.

## Product north star

A respondent should feel they are answering one calm question at a time. A creator should feel that editing is immediate, safe, and easy to understand. The current project has good visual ingredients (cards, theme tokens, animation, question-centric filler) but the experience is split across duplicated code paths and dense builder chrome.

## P0 — experience blockers

### 1. Builder is a three-pane desktop composition with no proven mobile information architecture

- **Files:** `src/components/forms/form-builder.tsx`, `design-panel.tsx`, `question-editor.tsx`.
- **Observed:** the builder combines question navigation, editing canvas, and settings/logic/design panels. The prior worklog also calls the three-panel mobile layout unresolved.
- **Risk:** on a phone, sidebars either squeeze the editing canvas below a usable width or force horizontal/scroll context switching. This is the highest UI risk because it affects the core creation workflow.
- **Direction:** desktop can retain a left outline + central canvas + right inspector. At widths below 1024px, show one canvas and move outline/inspector into explicit slide-over drawers. Preserve the selected question and unsaved state when drawers close.
- **Acceptance:** at 375px, creators can add, edit, reorder, configure logic, publish, and preview without horizontal page scrolling or hidden critical controls.

### 2. Save state is silent and error recovery is weak

- **Files:** `src/components/forms/form-builder.tsx:~190–255`.
- **Observed:** autosave catches errors silently; the worklog claims transactional saves but the user is not told whether edits are pending, saved, or failed.
- **Risk:** a creator can close the page believing changes saved, especially during a network outage.
- **Direction:** persistent compact status in the header: `Saving…`, `Saved just now`, `Couldn’t save — Retry`. Keep a local dirty snapshot and offer retry. Do not treat an autosave failure as invisible.
- **Acceptance:** throttled/offline test preserves edits, shows an actionable error, and succeeds after retry.

### 3. Filler parity is visibly and behaviorally unreliable

- **Files:** `src/app/f/[slug]/slug-form-filler.tsx`, `src/components/forms/form-filler.tsx`.
- **Observed:** the files are duplicated with major feature differences. This produces a visual/behavioral inconsistency between link recipients and creator preview.
- **Direction:** one shared `FillerExperience` with route-specific loading/preview wrappers. Use the same welcome, question, validation, footer, ending, redirect, keyboard and accessibility behavior.
- **Acceptance:** screenshot and interaction snapshots match between public link and preview for an identical form.

## P1 — usability and polish

### 4. Dashboard needs a stronger task hierarchy

- **Files:** `src/components/forms/dashboard.tsx`, `form-card.tsx`.
- **Observed:** feature density is high (workspaces, templates, search, favorite/archive, import, multiple list modes). Existing worklog calls out hover and loading states as unfinished.
- **Direction:**
  - Make **New form** the unmistakable primary action.
  - Keep workspace/filter context visible in the header on mobile.
  - Use one clear card hierarchy: form title, publication status, response count, modified time, then secondary actions.
  - Include intentionally designed loading skeletons, empty workspace, no-search-results, and request-error states.
  - Avoid actions visible only on hover; touch and keyboard users need an explicit overflow menu.
- **Acceptance:** first-time user can create, find, duplicate, archive, and open responses for a form in five minutes using mouse, touch, or keyboard.

### 5. Builder canvas should feel like the product, not a configuration dialog

- **Files:** `question-editor.tsx`, `form-builder.tsx`.
- **Observed:** controls/settings compete with the central question visual. Worklog correctly identifies a need for a more refined Typeform-like preview.
- **Direction:** use a large central question canvas with restrained chrome; show contextual controls on focus/selection rather than always. Keep question number/title/input visually close, with an obvious next/continue affordance. Inspector edits should update preview in place.
- **Acceptance:** the central canvas is legible at a glance at 1280px and is the dominant visual region, without settings labels crowding it.

### 6. Keyboard-only flow needs real accessibility verification

- **Files:** both fillers, `question-input.tsx`, `keyboard-shortcuts.tsx`.
- **Observed:** individual inputs include Enter behavior, but native keyboard coverage is inconsistent by type and no complete browser test exists. Decorative motion and button controls require focus/semantic review.
- **Direction:** define a single keyboard contract: Tab/Shift+Tab respects native focus; Enter advances only where appropriate; arrows select radios/scales; Space toggles legal/choices; Escape closes dialogs; visible focus never disappears. Add polite announcements for question changes/errors.
- **Acceptance:** keyboard-only user can complete all 14 question types, correct validation errors, reach ending/redirect, and never lose focus.

### 7. Dark mode needs design-token rather than per-screen confidence

- **Files:** global theme provider plus dashboard/builder/filler components.
- **Observed:** dark-mode screenshots exist in repo, but a screenshot is not a full contrast/state audit.
- **Direction:** use semantic tokens for surfaces, borders, muted text, input states, status colors, and chart colors. Audit all `style={{ color/backgroundColor }}` overrides against each form theme and dark UI shell.
- **Acceptance:** WCAG AA text contrast for default dark mode and for every selected form theme; no white flash/white surface in dialogs, menus, tooltips, form input or response views.

## P2 — response viewing and content design

### 8. Response viewer needs a credible export/review workflow

- **Files:** `responses-viewer.tsx`, `question-summary.tsx`.
- **Observed:** analytics/export code exists but TypeScript errors are present and no submit-to-export validation occurred.
- **Direction:** surface totals, completion rate, date range and filters first; distinguish partial responses; make download labels explicit (`CSV — 48 responses`). Provide error/empty states and make charts readable without color alone.

### 9. Motion should support, not delay, task completion

- **Files:** filler animation blocks, `framer-motion` transitions.
- **Observed:** several animation definitions currently fail typecheck.
- **Direction:** fix typing, honor `prefers-reduced-motion`, keep transition durations short, and never delay submit/error/focus feedback.

## Proposed component architecture

```text
components/forms/
  filler/
    filler-experience.tsx       # shared respondent UI/state machine
    filler-navigation.ts
    answer-validation.ts
    screens/{welcome,question,ending,error}.tsx
  builder/
    builder-shell.tsx           # responsive layout and drawers
    question-outline.tsx
    question-canvas.tsx
    inspector.tsx
    save-status.tsx
  dashboard/
    dashboard-shell.tsx
    form-grid.tsx
    workspace-nav.tsx
```

This is a target structure, not an instruction to rewrite everything at once. First extract behavior with tests; then move presentation.

## Required UX evidence before sign-off

| Workflow | Viewports | Themes | Evidence |
| --- | --- | --- | --- |
| Dashboard list/create/search/workspace | 1440, 768, 375 | light/dark | Playwright screenshots + keyboard test |
| Builder create all 14 types and logic | 1440, 768, 375 | light/dark | visual regression + no horizontal overflow assertion |
| Public and preview filler | 1440, 375 | form themes + dark shell | route-parity screenshots and answer record assertion |
| Responses/filter/export | 1440, 375 | light/dark | CSV fixture comparison |
| Accessibility | all | all | axe scan + keyboard-only complete run |

## Prioritized implementation sequence

1. Fix security/data/type gates so UI work has a stable backend.
2. Consolidate filler logic, then write the all-question E2E fixture.
3. Make builder responsive with drawer-based panels and visible save state.
4. Rework dashboard hierarchy/loading/error/empty states.
5. Perform token/contrast/reduced-motion pass.
6. Capture and approve visual baselines with the client.
