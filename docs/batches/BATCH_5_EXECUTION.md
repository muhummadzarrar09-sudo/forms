# Batch 5 — Repository Hygiene, URLs, and Sitemap

**Completed locally:** 2026-07-20. No commit, deploy, migration, or Git-history rewrite was performed.

## Cleanup

- Removed all tracked PNG artifacts from the repository root (`qa-*`, `qa-round*`, `qa-r*`, `qa-v*`, and `screenshot-*`) and the orphaned `upload/` directory.
- These were historical QA screenshots/pasted-image artifacts, not application assets. `public/` contains the intentionally shipped static assets; no production UI import referenced the deleted files.
- Removed now-empty `download/` and `upload/` directories.

## Documentation structure

All root project documentation was moved under `docs/` and an index was added at `docs/README.md`.

```text
docs/
  README.md
  audits/          handoff and UI/UX audits
  batches/         remediation batch execution reports
  planning/        revival/release plan
  history/         historical worklog
  archive/         retired directory documentation
  agent-context/   retained historical agent task context
```

The docs index also defines the application route map and source layout. No root Markdown files remain.

## Browser-history route behavior

The former app treated dashboard, builder, preview, and responses as only Zustand state. It also used `router.replace('/')` for filler routes. That erased the current route from browser history, so Back frequently left the app.

This batch introduces URL-backed app state:

| Creator view | URL |
| --- | --- |
| Dashboard | `/` |
| Builder | `/?view=builder&form=:id` |
| Responses | `/?view=responses&form=:id` |
| Preview | `/?view=preview&form=:id` |
| Public form | `/f/:slug` |

Store navigation now creates a browser-history entry for creator transitions. `src/app/page.tsx` derives the Zustand state from the current URL, including browser Back/Forward transitions. Legacy `/?form=:id` public share mode remains supported; future public links should use `/f/:slug`.

A first-ever direct deep-link cannot have an earlier in-app history entry by definition; in that case the visible in-app back controls still route to dashboard. Normal dashboard → builder/preview/responses navigation now has an actual dashboard history entry.

## Sitemap

Added `src/app/sitemap.ts`:

- exposes `/sitemap.xml`;
- includes only the root and published form slugs;
- keeps dashboard/builder/responses/preview out of search indexing;
- is forced dynamic so a database availability issue at build time does not fail deployment or produce a stale sitemap.

## Verification actually run

| Check | Result |
| --- | --- |
| `bun test` | 4 passed / 8 assertions |
| `bunx tsc --noEmit` | passed, exit 0 |
| `bun run lint` | passed, exit 0 |
| `bun run build` | passed, exit 0; `/sitemap.xml` registered dynamic |
| PNG inventory outside build/dependencies | zero files remain |
| Root Markdown inventory | zero files remain |
| `git diff --check` | passed |

## Still needed

Browser Back/Forward behavior should be validated with Playwright against the authenticated dashboard and mobile viewport once test credentials and a disposable environment are available. This batch provides the route/history implementation and compile/build verification, not a claimed manual browser sign-off.
