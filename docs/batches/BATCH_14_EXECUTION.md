# Batch 14 — Builder/Dashboard UX Repair

## Delivered

- Fixed the Add Question picker’s scrolling model: the dialog now has a viewport-bounded flex layout, a non-shrinking header, and a `min-h-0 flex-1` scroll region. Long type lists remain reachable on small screens.
- Fixed the empty-builder callout arrow: it now points down toward the Add Question action rather than being rotated upward.
- Mobile builder starts with a clear editing canvas and opens settings only through its drawer control; icon controls have accessible names.
- Sidebar account identity now uses the authenticated name/email-derived display name and initial. Removed the invented `User` / `Free plan` labels in favor of `Personal workspace`.
- Made sidebar navigation actionable: Templates opens the template form flow; Themes opens an Appearance selector; Resources opens keyboard help and project documentation.
- Renamed the builder’s ambiguous `Preview` action to `Test form` / `Test form as a respondent`.

## Verification

- clean install and Prisma generate: passed
- `bun run test:unit`: 11 passed / 26 assertions
- `bunx tsc --noEmit`: passed
- `bun run lint`: passed
- `bun run build`: passed

Browser execution remains pending the Docker/Chromium environment, but the existing mobile Playwright fixtures target the picker/builder route and can be expanded to assert these UI changes.
