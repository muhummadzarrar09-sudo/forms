# Batch 15 — Verified Workspace UX Completion

This batch replaces the previous partial claims with concrete source-level implementations.

## Builder: real Editor / Preview workspace modes

- Added `src/components/forms/builder-form-preview.tsx`.
- Added a real **Editor / Preview** segmented workspace mode in `form-builder.tsx`.
- Preview is embedded inside the builder, uses the current draft form state, supports welcome/question/ending navigation, logic, custom endings, progress, back/reset, and never persists a response.
- Editor mode restores the outline, canvas, and inspector.
- On mobile, a labelled icon toggles the same modes. Settings are unavailable while previewing, preventing the three-panel workspace from becoming congested.
- The full-screen action remains separate and is now explicitly named **Test form**.

## Builder picker/empty state

- Add Question picker uses a bounded flex dialog and real scrolling viewport.
- Empty-state callout arrow points down to its intended action.

## Dashboard: actual destinations and identity

- Session-backed display name/email fallback and avatar initial replace static `User`.
- `Personal workspace` replaces the invented billing label.
- Templates, Themes, and Resources now render actual dashboard destinations—not just dialogs or inactive visual nav items.
- Templates has a browsable gallery which opens the selected template in the real create-form flow.
- Themes has an Appearance destination for light/dark/system.
- Resources has keyboard-help and documentation destinations.
- Template/import question batches now include stable client IDs required by the hardened questions API, so template creation does not silently create empty forms.

## Verification

- `bunx tsc --noEmit`: passed
- `bun run lint`: passed
- `bun run test:unit`: 11 passed / 26 assertions
- `bun run build`: passed before the final E2E assertion extension
- E2E mobile builder spec now asserts Editor → embedded Preview → Editor behavior; browser execution remains pending Docker/Chromium.
