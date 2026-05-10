# Task 2-a: Bug Fix Agent

## Task
Fix 4 critical bugs in the Forms (Typeform clone) application.

## Bugs Fixed

### Bug 1: Grid card title click navigates to builder instead of inline edit
- **File**: `/home/z/my-project/src/components/forms/form-card.tsx`
- **Change**: Grid view h3 `onClick` changed from `setIsEditingTitle(true)` to `onEdit(form.id)`
- **Addition**: Added "Rename" dropdown menu item in grid view dropdown (before "Duplicate")
- List view behavior unchanged

### Bug 2: Multiple choice stores option IDs instead of labels
- **File**: `/home/z/my-project/src/components/forms/question-input.tsx`
- **MultipleChoiceInput**: `handleSelect` stores `option.id` (single) or comma-separated IDs (multi)
- **PictureChoiceInput**: Same fix
- **DropdownInput**: Stores `option.id`, added `selectedOption`/`displayValue` for showing labels
- **isSelected checks**: All now compare against `option.id` instead of `option.label`
- Aligns with logic evaluation in `form-filler.tsx` which uses `selectedIds.includes(field)` where field is an option ID

### Bug 3: Status indicator and dropdown menu overlap resolved
- **File**: `/home/z/my-project/src/components/forms/form-card.tsx`
- **Change**: Moved status indicator from `absolute top-2 right-2` to `absolute top-2 left-10`
- Favorite heart stays at `left-2`, status dot now at `left-10`
- Dropdown trigger remains at `top-2 right-2` with no overlap

### Bug 4: Sort dropdown uses shadcn Select
- **File**: `/home/z/my-project/src/components/forms/dashboard.tsx`
- Replaced native `<select>` with `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue`
- Added imports for shadcn Select components
- Styled to match previous visual weight (transparent, borderless, small)

## Verification
- ESLint: No errors
