# Forms Revival Plan

**Status:** Phase 0 / discovery complete — no deployment or history rewrite performed.

## Non-negotiable release gates

1. Replace and rotate exposed credentials; remove `.env` from all reachable Git history immediately before the next deploy.
2. A single, documented production database plus reviewed Prisma migrations.
3. Zero `eslint`, TypeScript, build, and test failures.
4. Two-user authorization suite, response-integrity tests, and concurrent PostgreSQL cap test green.
5. One shared filler engine used by public slug and in-app preview.
6. Browser/device/accessibility evidence for dashboard, builder, and filler in light/dark mode.

## Phase 1 — Stabilize the foundation

- [x] Remove `.env` from future Git tracking in this checkout (pending commit; history cleanup deferred by owner).
- [ ] Replace committed sensitive values with `.env.example` placeholders after rotations are scheduled.
- [ ] Resolve the production database decision: PostgreSQL or SQLite, not both.
- [ ] Generate/review Prisma migrations and remove tracked stale `db/custom.db` from product source.
- [ ] Remove unsafe Caddy transform-port proxy and dead WebSocket/miniservice artifacts.
- [ ] Fix critical authorization and response-integrity issues.
- [ ] Restore a zero-error typecheck.

## Phase 2 — Make the product trustworthy

- [ ] Consolidate both fillers into shared state/navigation/submit logic.
- [ ] Build server-side answer validation and a bounded, testable logic engine.
- [ ] Add a respondent-edit token or remove persisted public partials.
- [ ] Add transaction/concurrency tests and autosave rollback tests.
- [ ] Add a deterministic template cloning/export-import test suite.

## Phase 3 — Typeform-like UX reconstruction

- [ ] Dashboard: clear hierarchy, useful empty/loading/error states, keyboard commands, mobile nav.
- [ ] Builder: single focused canvas, collapsible drawers rather than three fixed panels on small screens, visible save state and recovery.
- [ ] Filler: distraction-free, accessible, error-safe, consistent across public/in-app paths.
- [ ] Build a visual regression and accessibility test matrix.

## Phase 4 — Release hardening

- [ ] CI blocks on lint, types, tests, migration status, and production build.
- [ ] Preview/staging smoke test creates a test form, runs 14 input types, logic/endings/export, then cleans up.
- [ ] Rewrite Git history and force-push only after all consumers are notified; rotate/redeploy afterward.
- [ ] Client handoff packet: deployment/runbook, schema/migration runbook, credential ownership, backup/restore, monitoring, known limits.
