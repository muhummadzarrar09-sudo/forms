# Batch 3 — Conditional Logic Foundation

**Approach:** deliberately staged. Read-only discovery found **1,138 lines** of difference between the public slug filler and the in-app filler. Rewriting both before defining a shared, tested logic contract would be a high-regression change. This batch establishes that contract first; the next batch can extract the shared filler against it.

## Delivered

### Shared pure logic engine

Added `src/lib/logic-engine.ts` with:

- a single condition evaluator used by both filler implementations;
- deterministic first-match rule precedence;
- backward compatibility for the existing `condition` shape;
- multi-condition support via `conditions` plus `conditionMatch: 'all' | 'any'`;
- compatibility for both historic choice-option storage in `condition.field` and the editor’s selected option value in `condition.value`;
- potential self/two-or-more-question cycle detection utility.

Both `form-filler.tsx` and `slug-form-filler.tsx` now use the same `ruleMatches` evaluator. This removes one important source of route drift without changing the visible filler layout in a risky rewrite.

### Data model / API contract

- Added `LogicCondition` and optional multi-condition fields to the form types.
- Extended Zod question-save validation to permit up to ten conditions per rule and `all`/`any` match behavior while retaining required legacy `condition` data.
- Existing forms and the current single-condition editor remain valid.

### Tests and quality gate

- Added `tests/logic-engine.test.ts` covering ALL, ANY, choice compatibility, rule precedence, self-loop, and two-question loop behavior.
- Added `bun test` script and enabled `bun-types` in TypeScript configuration.

## Verification actually run

| Check | Result |
| --- | --- |
| `bun test` | 4 tests passed / 8 assertions |
| `bunx tsc --noEmit` | passed, exit 0 |
| `bun run lint` | passed, exit 0 |
| `bun run build` | passed, exit 0 |
| `git diff --check` | passed |

## Intentionally deferred to the next controlled batch

1. **Logic editor UI:** it still creates a single condition. Multi-condition UI needs to be added on top of this tested contract, not guessed first.
2. **Save-time graph enforcement:** `findLogicCycles` exists and is tested; question-save must next validate target ownership/existence and reject cycles with a clear creator-facing error. This requires a careful decision for brand-new, unsaved question IDs.
3. **Filler extraction:** public and in-app fillers still differ in loading, preview, partial-save, and chrome behavior. The safe extraction is a shared state/navigation/submit hook plus thin route wrappers—not a blind copy/paste merge.
4. **Full 14-type / browser E2E suite:** not yet run because no isolated PostgreSQL test environment or browser test harness has been provisioned.
