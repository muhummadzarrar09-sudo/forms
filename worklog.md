# Forms App — Work Log

## Session: v7 Critical Fixes (FIX 1–7)

### Project Status
- Next.js 16 App Router / Prisma+SQLite / NextAuth.js credentials / PBKDF2-SHA512 password hashing
- Dev server uses `--webpack` mode (Turbopack crashes with combined ESM deps like zod+Prisma+next-auth)
- Password hashing uses Node.js crypto (PBKDF2) instead of bcryptjs (bcryptjs v3 ESM-only crashes Turbopack)

### Completed Fixes

**FIX 1 — `src/middleware.ts` (NEW)**
- Created IP-level rate limiting at the edge middleware
- 5 registrations per 15 min, 20 login attempts per 15 min
- In-memory store (resets on cold start, acceptable for edge)

**FIX 2 — `src/lib/auth.ts` (per-email rate limiting)**
- Imported `checkRateLimit`, `recordRateLimitAttempt`, `resetRateLimit` from `./rate-limit`
- Per-email brute-force protection: 20 failed attempts per 15-min window
- Records attempts for missing users (prevents enumeration timing)
- Resets rate limit on successful login

**FIX 3 — `src/lib/auth.ts` (remove dead bcrypt migration)**
- Removed unreachable bcrypt migration block (`$2b$`/`$2a$` check)
- `verifyPassword()` always returns `false` for bcrypt hashes, so migration was dead code
- Added comment: "bcrypt hashes from pre-PBKDF2 versions are not supported. Affected users must re-register."
- Removed `hashPassword` re-export from auth.ts (only used by dead migration path; still in crypto.ts for register route)

**FIX 4 — `src/app/api/auth/register/route.ts` (name validation)**
- Changed `typeof name !== 'string'` to `typeof name === 'string'` — the length check was impossible before

**FIX 5 — `src/app/api/forms/[id]/responses/route.ts` (TOCTOU race)**
- Moved `maxResponses` count check inside `db.$transaction()` using `tx.response.count()`
- Throws `LIMIT_REACHED:N` error inside transaction, caught and converted to 403 response
- Prevents two concurrent submissions from both passing the count check

**FIX 6 — `src/app/f/[slug]/slug-form-filler.tsx` (show_ending handler)**
- Added `activeEnding: FormEnding | null` to `FillerState` interface
- Added `handleSubmitWithEnding` callback that submits + shows specific ending
- Added `show_ending` action handling in `goNext` logic rule evaluation loop
- Updated ending screen JSX to use `activeEnding` title/message/redirectUrl when present
- Falls back to default form ending fields when no specific ending

**FIX 7 — `src/app/api/forms/[id]/route.ts` (transactional endings CRUD)**
- Wrapped form update + endings CRUD inside single `db.$transaction()`
- Re-fetches form inside transaction after endings modifications
- Removed separate re-fetch outside transaction
- Cleaned up unused `formFields` variable and `include` on update (not needed since result unused)

**Additional — `src/lib/rate-limit.ts`**
- Added `resetRateLimit(key)` function to clear rate limit on successful login

**Additional — zod upgrade**
- Upgraded zod from 3.23.8 → 3.25.48 to satisfy eslint-plugin-react-hooks v7 dependency

---

## Session: UI/UX Polish & QA

### Project Status
- All v7 critical fixes (FIX 1–7) confirmed in place and working
- ESLint passes clean, dev server compiles without errors
- Auth (register/login) working correctly with PBKDF2 hashing
- Rate limiting active at both IP (middleware) and per-email (auth.ts) levels

### UI Fixes Applied

**1. Form Filler Padding Sync — `slug-form-filler.tsx` + `form-filler.tsx`**
- Increased horizontal padding from `px-6` to `px-8` for the main content area
- Added `pb-20` bottom padding to prevent content from being hidden behind the bottom bar
- Bottom bar padding synced to match content area: `px-8 md:px-16 lg:px-24 py-4 md:py-6`

**2. Bottom Bar + Keyboard Hints Overlap Fix**
- Moved keyboard shortcut hints from `bottom-16` to `bottom-28` to prevent overlap with bottom bar
- Moved "Powered by Forms" branding from `bottom-2` to `bottom-14` for proper spacing
- Both files (slug-form-filler + form-filler) updated consistently

**3. Question Screen Layout Sync**
- Changed `space-y-8` to `space-y-6` for consistent vertical rhythm between question elements
- Added `pt-2` wrapper around QuestionInput for better visual separation
- Removed negative margin (`-mt-4`) from description — now uses proper spacing flow
- Question number indicator updated: `text-xs font-semibold uppercase tracking-wider opacity-50` — cleaner Typeform-style label
- Required indicator: Changed from `*` to `Required` text label with `text-xs font-semibold uppercase tracking-wider`
- Format: `1 ↦ 5` instead of `1 of 5` for question counter

**4. Question Input Width Constraints — `question-input.tsx`**
- Removed redundant `max-w-2xl` from all individual question input wrappers
- Parent already constrains to `max-w-2xl`, so child constraints were redundant and created inconsistent sizing
- Picture choice: Removed `max-w-3xl` — now uses consistent `w-full` grid layout
- All 14 input types updated: ShortText, LongText, MultipleChoice, PictureChoice, Dropdown, YesNo, Email, Phone, Number, Website, Date, Rating, OpinionScale, Legal

**5. Builder Question Editor Padding — `question-editor.tsx`**
- Increased editor section padding from `px-6 py-8` to `px-8 md:px-12 py-10` for better breathing room
- Changed outer `space-y-8` to `space-y-6` for consistent rhythm
- Changed inner `space-y-6` to `space-y-5` for tighter grouping

**6. Ending Screen Button Styling**
- Redirect/Continue button: Added `py-3`, `hover:scale-[1.02]`, `active:scale-[0.98]`, and subtle `boxShadow` for premium feel
- Added `ArrowRight` icon to Continue button in slug-form-filler
- "Submit another response" button: Changed from filled to outline style (transparent bg + border) for visual hierarchy — primary action (continue) is filled, secondary (resubmit) is outline
- Both fillers updated consistently

### Verification
- ESLint: passes with zero errors
- Dev server: compiles without errors
- All changes are purely UI/styling — no logic changes

### Unresolved / Risks
- Pre-existing TypeScript errors in questions/route.ts, workspace route remain (not UI-related)
- The form builder center panel could benefit from a more refined Typeform-like preview experience
- Dashboard could benefit from better card hover animations and loading states
- Mobile responsiveness could be further refined for the form builder 3-panel layout

---

## Session: UI Padding Fix — Surgical Padding Corrections

### Task ID: 1-6
### Agent: main

### Project Status
- All v7 critical fixes (FIX 1-7) in place
- Auth working correctly, NOT touched in this session
- ESLint passes clean, dev server compiles without errors

### UI Padding Fixes Applied

**1. Dashboard Sidebar Nav Items — `dashboard.tsx`**
- Changed nav `space-y-0.5` to `space-y-1` for more breathing room between nav items
- Unified nav button padding from `px-3 py-2.5` to `px-3 py-2` for all nav items (Home, Templates, Themes, Resources) — consistent height
- Unified workspace button padding from `px-2.5 py-2` to `px-3 py-2` — matches nav items

**2. Dashboard Top Bar Buttons — `dashboard.tsx`**
- Changed button gap from `gap-2` to `gap-1.5` for tighter, more consistent spacing
- Changed Import/New Form buttons from `size="default"` + `gap-2` to `size="sm"` + `h-8` + `gap-1.5` — consistent with the header height
- Reduced icon sizes from `size-4` to `size-3.5` on Import/New Form buttons for visual balance

**3. Form Builder Left Sidebar — `form-builder.tsx`**
- Reduced Welcome Screen section `pb-1` to `pb-0.5` — less wasted space
- Reduced button padding from `px-3 py-2` to `px-2.5 py-1.5` for Welcome/Ending screen items — more compact, in sync with question items
- Changed "Add question" button from `p-3` to `px-3 py-2` and from `text-sm` to `text-xs h-8 gap-1.5` — more compact, less visual weight
- Changed "Add question" button icon from `size-4` to `size-3.5` — proportional
- Added `pt-0.5` to Ending Screen section — tighter gap between Add question and Ending Screen

**4. Form Builder Top Bar — `form-builder.tsx`**
- Changed gap from `gap-2` to `gap-1.5` for more consistent button spacing

**5. Form Builder Right Sidebar — `design-panel.tsx`**
- Changed all `space-y-5` to `space-y-4` across QuestionSettingsTab, LogicTab, FormSettingsTab, DesignTabContent — tighter, more consistent section spacing
- Changed tabs content `space-y-5` to `space-y-4` — matches the rest

**6. Form Builder Center Content — `question-editor.tsx`**
- Removed absolute-positioned question number and Required indicator
- Added them as a flex row at the top of the editor content — properly aligned and in-flow
- Question counter now shows "1 of 2" format (matching the preview) instead of "1/2" — consistent between preview and editor
- Reduced OK button from `size="lg" px-8 h-12` to `size="default" px-6 h-10 text-sm` — tighter, more proportional
- Reduced OK button icon from `size-5` to `size-4` — proportional
- Reduced "press Enter" text from `text-sm` to `text-xs` — less visual noise
- Added `mt-2` to OK button and Continue button — consistent tight spacing from input to button

**7. Form Card — `form-card.tsx`**
- Reduced colored header from `h-28` to `h-24` — more compact card
- Reduced CardContent padding from `p-4` to `p-3.5` and gap from `gap-2` to `gap-1.5` — tighter internals
- Reduced footer border-top padding from `pt-2` to `pt-1.5` — tighter footer
- Changed quick action buttons from `text-xs mr-1` to `text-[11px] gap-1` — more compact, consistent icon+text spacing

### Verification
- ESLint: passes with zero errors
- Dev server: compiles without errors, all pages render 200
- Auth: NOT modified, still working
- No logic changes — only padding/spacing CSS adjustments
