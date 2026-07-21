# Batch 4 — Logic Authoring & Save-Time Safety

**Completed locally:** 2026-07-20. No production database, deployment, or Git-history action was performed.

## Deliberate design decisions

Before editing, I inspected how questions receive IDs and how autosave persists them. New builder questions already receive client-generated `temp_*` IDs. The previous API discarded those IDs and generated unrelated DB IDs, which made same-save logic targets inherently unstable. This batch fixes that contract before enforcing graph validity.

I did **not** merge the 1,138-line-different fillers in this batch. The newly shared engine and safe logic persistence are prerequisites for that extraction.

## Delivered

### Multi-condition logic UI

`src/components/forms/design-panel.tsx` now provides:

- **Add condition** for each rule;
- **All conditions / Any condition** selector;
- a removable, editable condition list;
- condition-specific field/operator/value controls;
- backwards-compatible single-condition authoring remains compact.

The editor writes the Batch 3 `conditions` and `conditionMatch` data contract while continuing to maintain the legacy first `condition` property.

### Stable question identifiers

`src/app/api/forms/[id]/questions/route.ts` now:

- requires a stable ID on every question submitted by the autosave batch;
- retains that client-created ID when inserting a new Question instead of silently replacing it;
- rejects an ID collision with a Question from another form.

This allows a new question and a rule targeting it to be persisted atomically in one save.

### Save-time logic integrity enforcement

The question save route now rejects:

- self-jumps;
- jumps to an ID outside the submitted form;
- custom-ending references outside the same form;
- potential circular question-jump paths;
- references to a question deleted in the same save.

The response returns a 400 with a creator-actionable message; cycles also return their detected path.

## Verification actually run

| Check | Result |
| --- | --- |
| `bun test` | 4 passed / 8 assertions |
| `bunx tsc --noEmit` | passed, exit 0 |
| `bun run lint` | passed, exit 0 |
| `bun run build` | passed, exit 0 |
| `git diff --check` | passed |

## Remaining risks / next batch

1. **Shared filler extraction:** still the main maintenance risk. Next batch should extract a shared state/navigation/submission hook with route-specific adapters, retaining public/in-app differences only where intentional.
2. **End-to-end coverage:** UI behavior and the question-save transaction need isolated PostgreSQL integration tests. Unit tests currently cover the pure engine only.
3. **Forward-only policy:** cycle prevention allows a backward jump if it cannot form a graph cycle. Product may choose to restrict all jumps to later questions for simpler respondent navigation; that is a product decision, not a silent implementation choice.
4. **Existing malformed data:** a legacy form that already has invalid logic will now be rejected when it is next saved. This is correct for safety, but a one-time data audit/repair tool may be needed before deployment.
