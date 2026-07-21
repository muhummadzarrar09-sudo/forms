---
Task ID: 3
Agent: task3-agent
Task: Implement form duplication API + UI and response deletion API + UI

Work Log:
- Created `/src/app/api/forms/[id]/duplicate/route.ts` — POST endpoint that finds a form by ID, creates a new form with title "Copy of {original title}" and published=false, copies all questions with new auto-generated IDs, returns the new form with questions
- Created `/src/app/api/forms/[id]/responses/[responseId]/route.ts` — DELETE endpoint that verifies the response belongs to the form, deletes the response (cascade deletes answers), returns success confirmation
- Updated `/src/components/forms/form-card.tsx` with Duplicate option in both grid and list dropdown menus
- Updated `/src/components/forms/dashboard.tsx` to pass onDuplicate prop wiring to addForm store action
- Updated `/src/components/forms/responses-viewer.tsx` with delete button and AlertDialog confirmation on expanded response cards
- Ran ESLint: no errors

Stage Summary:
- Form duplication: Full API + UI flow — duplicate any form from dashboard dropdown, creates draft copy with all questions
- Response deletion: Full API + UI flow — delete individual responses with confirmation dialog from expanded response card
- Both features include proper loading states, error handling, and toast notifications
- All existing functionality preserved
