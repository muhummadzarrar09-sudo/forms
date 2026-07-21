# Batch 2 — Response Correctness Execution

**Completed locally:** 2026-07-20. No production records, credentials, migrations, or deployment were touched.

## Delivered changes

### Hidden field response handling

- Removed the invalid approach of turning hidden fields into fake `Answer.questionId` values such as `__hidden_<id>`.
- In-app filler now stores hidden-field values in response `metadata.hiddenFields`.
- Public slug filler now reads configured URL/default hidden fields too and stores them in the same metadata location.
- This fixes the prior foreign-key submission failure and eliminates a functional difference between the two filler paths for hidden fields.

### Server-side response value validation

The public response API now validates submitted values from the persisted question configuration rather than trusting browser controls alone:

- email format
- phone format
- HTTP/HTTPS website URL
- ISO date shape
- finite numeric values and configured min/max bounds
- legal consent must be `true`
- Yes/No values
- choice/picture-choice/dropdown option IDs
- malformed stored option/settings JSON returns a safe validation error

It applies on completed submissions, initial partial creation, and partial updates. Existing checks still reject foreign or duplicate question IDs.

## Verification actually run

| Check | Result |
| --- | --- |
| `bunx tsc --noEmit` | passed, exit 0 |
| `bun run lint` | passed, exit 0 |
| `bun run build` | passed, exit 0 |
| `git diff --check` | passed |

## Deliberately not claimed as complete

- The two fillers are still separate components; Batch 2 aligned hidden-field behavior but did not yet perform the larger shared-engine extraction.
- Logic rules still require a redesign for multi-condition AND/OR groups and static cycle detection.
- Required-question enforcement is intentionally navigation-aware: a server cannot simply require every persisted required question because branching can legitimately skip questions. The next logic batch must transmit/verify the visited route or use a server-side logic evaluator.
- No integration/database test was run against production. Server validation needs a dedicated PostgreSQL test suite with all 14 question types and boundary cases before deployment.
