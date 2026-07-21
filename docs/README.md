# Project Documentation

## Delivery and audit record

- `audits/handoff-audit.md` — pre-handoff security, data, functional, and deployment audit.
- `audits/ui-ux-audit.md` — Typeform-like UX direction and validation matrix.
- `batches/` — execution reports for each remediation batch.
- `planning/revival-plan.md` — phased release plan and non-negotiable gates.
- `TESTING.md` — isolated test database setup, required test matrix, and release gates.
- `DEPLOYMENT.md` — fresh Supabase/Vercel deployment and post-deploy smoke-test runbook.
- `history/worklog.md — historical worklog retained for context; it is not a release acceptance record.
- `archive/` — retired documentation from removed/dead directories.
- `agent-context/` — prior agent task context retained as historical implementation context.

## Application route map

| Route | Audience | Purpose |
| --- | --- | --- |
| `/` | authenticated creators | Dashboard; app-state routes are represented by URL query state. |
| `/?view=builder&form=:id` | authenticated creator | Form builder. |
| `/?view=responses&form=:id` | authenticated creator | Response viewer. |
| `/?view=preview&form=:id` | authenticated creator | In-app draft/preview filler. |
| `/f/:slug` | public respondent | Published form filler. |
| `/api/*` | API clients | Application APIs; see the route source and audit. |

Legacy `/?form=:id` remains supported as a public share-mode route during transition. New public share links should use `/f/:slug`.

## Source layout

```text
src/
  app/            App Router pages, API endpoints, metadata/sitemap
  components/     UI and feature components
  lib/            shared domain, security, serialization, and logic utilities
  store/          client app state
  types/          shared TypeScript contracts
tests/            pure/domain tests (Bun)
prisma/           schema and reviewed migrations
docs/             delivery, audit, planning, and historical documentation
public/           intentionally shipped static assets only
```
