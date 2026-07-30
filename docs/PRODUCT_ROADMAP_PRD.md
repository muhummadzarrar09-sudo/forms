# Forms Product Roadmap PRD

**Status:** Active execution roadmap  
**Owner:** Product / engineering  
**Last updated:** 2026-07-29

## Vision

Make Forms a brand-first, adaptive form platform that combines a polished Typeform-like respondent experience with a practical response workspace, automation, and integrations. A creator should be able to build a personalized form, qualify/route responses, and deliver data to their workflow without needing a separate tool.

## Product principles

1. **Respondent first:** fast, accessible, branded, and trustworthy public forms.
2. **Creator leverage:** templates and plain-language configuration over technical setup.
3. **Safe automation:** integrations must be encrypted, idempotent, observable, and never delay a submission.
4. **Data ownership:** complete CSV/JSON exports and clear retention controls.
5. **Progressive complexity:** advanced features are optional; simple forms remain simple.

## Success metrics

- Public-form completion rate and median completion time.
- Draft-resume recovery rate.
- Percentage of new forms created from templates.
- Time from response receipt to qualified/follow-up status.
- Integration delivery success rate and median sync latency.
- Zero critical authorization, credential-storage, export-injection, or data-loss regressions.

---

## Phase 0 — Secure platform foundation

**Status: Complete in code; deferred database/runtime validation remains.**

### Delivered
- Ownership checks, input schemas, HTTPS asset/redirect rules, CSP/security headers.
- Hashed/expiring anonymous draft credentials and durable rate limits.
- Password reset, email verification, JWT invalidation after reset.
- Paginated response retrieval, server-side filtering, full streamed CSV/JSON exports.
- Response workflow status/private notes, analytics counts, cleanup/health endpoints.
- Branded public forms, OG previews, accessibility focus/progress support.

### Deferred validation gate
- Apply all Prisma migrations in a safe PostgreSQL environment.
- Regenerate Prisma client and run lint/typecheck/unit/E2E/build.
- Rotate/define production secrets and configure cron jobs.

---

## Phase 1 — Google Sheets integration completion

**Status: 1.1–1.4 complete in code; 1.5 pending credential/runtime validation.**

### 1.1 OAuth and encrypted token storage — Complete
- Google OAuth connect/callback.
- AES-256-GCM encrypted refresh/access tokens.
- Per-user disconnect.

### 1.2 Per-form destination configuration — Complete
- Analytics card, spreadsheet ID, worksheet name, destination verification.
- Enable/disable automatic sync and test-row action.

### 1.3 Reliable delivery — Complete
- Idempotent response outbox and cron-driven Sheets delivery worker.
- Token refresh, retry cap, last-sync/last-error state.

### 1.4 Analytics export surface — Complete
- Full streamed CSV and JSON exports in Analytics.

### 1.5 Sync history and operations — Next
- Creator-visible delivery history with response, timestamp, status, attempts, and error.
- Retry one/retry all failed events.
- Pending/failed/success counters.
- Sheet header initialization option.

### Acceptance criteria
- A connected creator can configure a worksheet, test append access, enable sync, see errors, and retry failures.
- Duplicate response events never append duplicate rows.
- Google failures never block public response completion.

---

## Phase 2 — Outcome-based template catalog

**Status: Not started.**

### Scope
- Template gallery with search/category filters and preview.
- Templates: lead qualification, project intake, job application, event registration, NPS, feedback, quiz/assessment, quote calculator, booking request, brand discovery.
- Each template includes questions, logic, endings, theme, hidden fields, and recommended workflow statuses.

### Acceptance criteria
- A creator can start with a complete high-quality form in under one minute.
- Template import has stable IDs and valid logic targets.

---

## Phase 3 — Calculated variables and adaptive outcomes

**Status: Not started.**

### Scope
- Named variables and arithmetic expressions based on answers.
- Safe interpolation: `{{score}}`, `{{variable:quote_total}}`, `{{answer:questionId}}`.
- Score/variable based conditional logic and ending selection.
- Calculation preview/debugger for creators.

### Acceptance criteria
- Calculations are deterministic, validated server-side, and never evaluate arbitrary code.
- Creators can build a quote/eligibility/recommendation form without custom code.

---

## Phase 4 — Response workspace maturity

**Status: 4.1 complete; 4.2 next after Phase 1.5.**

### 4.1 Status and notes — Complete
- New/reviewing/qualified/follow-up/closed workflow statuses.
- Private response notes and status filtering.

### 4.2 Workflow operations — Planned
- Star/priority, bulk updates, saved views, reminder dates, activity timeline.
- Team assignment after a future team/roles model exists.

---

## Phase 5 — Additional destinations

**Status: Not started.**

### Order
1. Generic webhooks via a secure outbox/egress policy.
2. Slack notifications.
3. Notion database destination.
4. CRM destinations (HubSpot first).
5. Calendar/booking handoff.

All destinations require encrypted credentials, idempotent outbox events, retries, error visibility, and explicit owner authorization.

---

## Phase 6 — Premium public-form conversion features

**Status: Partially complete.**

### Delivered
- Branding, logo/cover, public OG previews, completion estimate, browser/server draft resume, answer piping, accessibility improvements.

### Planned
- Custom welcome CTA text.
- Embeds (inline, popup, side panel).
- Custom domains, branded favicon, custom fonts.
- UTM/source attribution dashboard.
- Password-protected public forms.
- A/B testing for welcome/ending experiences.

---

## Phase 7 — Production release gate

**Status: Blocked on environment/setup, not code execution.**

- Resolve dependency advisories and regenerate `bun.lock`.
- Run all migrations and tests.
- Configure SMTP, Google OAuth, encryption key, cron secret, cron schedules.
- Add error monitoring/structured logs.
- Complete data retention, user export/deletion, and audit-history requirements.

## Execution protocol

- Work phases in order unless a security/blocking fix takes priority.
- At the start and end of every implementation update, report the phase identifier (for example **Phase 1.5**).
- Commit and push each completed iteration only to `arena/019f97f9-forms` / PR #2.
- Never merge without explicit user approval.
