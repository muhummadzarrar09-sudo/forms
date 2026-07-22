# Batch 16 — Catalog Intake Import V2

## Implemented in actual source

### Catalog JSON converter

Added `src/lib/catalog-intake-import.ts` and connected it to the dashboard import flow.

The supplied Catalog Website Intake JSON now converts into an app-native form with:

- mapped title, description, welcome title/message, ending title/message;
- six full `statement` section-break screens;
- stable question IDs and option IDs;
- `checkboxes` converted to `multiple_choice` with `allowMultiple` enabled;
- conditional question visibility;
- `allowOther` converted to a required visible-only “Please tell us more” follow-up;
- `file_upload` converted to a Website/link field rather than consuming Supabase Storage;
- HTML entities such as `&amp;` decoded to normal readable copy.

### Link-only asset flow

The logo upload question becomes a link request for Google Drive, Dropbox, OneDrive, or a public image URL. It contains editable WhatsApp/Instagram placeholder copy rather than invented contact details.

### Publish-time guard

If imported asset-link fields still contain placeholders such as:

```text
[your WhatsApp link]
[your Instagram profile]
```

publishing opens a real prompt with:

- Cancel
- Take me to the question
- Publish anyway

The first action returns the creator to Editor mode, opens the inspector, and selects the exact asset-link question for editing.

### Conditional visibility

Added `QuestionSettings.visibility` and shared navigation support. Imported conditional questions are skipped unless the referenced answer matches, including:

- Has variants → show variant details only for Yes
- Direct buying → show payment methods only for Direct buying
- Other choice → require the follow-up text field only when Other is selected

## Verification

- Added `tests/catalog-intake-import.test.ts`
- `bun run test:unit`: 13 passed / 41 assertions
- `bunx tsc --noEmit`: passed
- `bun run lint`: passed
- `bun run build`: passed

## Manual verification still needed after deploy

1. Import the full supplied Catalog JSON.
2. Verify all six section screens appear.
3. Select No for variants and confirm variant details are skipped.
4. Select Browse and confirm payment methods are skipped.
5. Select Other and confirm the follow-up is required.
6. Attempt to publish before editing asset fallback placeholders; verify the publish prompt.
