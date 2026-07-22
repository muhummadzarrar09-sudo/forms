# Public Developer API — V1 Contract & Security Plan

**Decision:** build for both personal automations and future SaaS customers.  
**V1 scope:** form/question CRUD, programmatic published-form response submission, API-key dashboard/rotation/revocation, webhooks, developer documentation, and signed delivery.  
**Rate limiting:** Upstash Redis on Vercel. Public endpoints remain disabled until durable rate-limit credentials are configured.

## Public surface

Initial versioned route prefix:

```text
/api/v1
```

A future `api.<domain>` can proxy to this prefix without changing the contract.

| Endpoint family | Scope | Notes |
| --- | --- | --- |
| `GET/POST /api/v1/forms` | `forms:read`, `forms:write` | List/create owner-scoped forms |
| `GET/PATCH/DELETE /api/v1/forms/:formId` | `forms:read`, `forms:write` | Form metadata/settings only |
| `GET/PUT /api/v1/forms/:formId/questions` | `forms:read`, `forms:write` | Validated atomic question graph save |
| `GET /api/v1/forms/:formId/responses` | `responses:read` | Cursor pagination/filtering; never exposes API key data |
| `POST /api/v1/forms/:formId/responses` | `responses:submit` | Published/open forms only; same validation/cap path as filler |
| `POST/GET/DELETE /api/v1/webhooks` | `webhooks:manage` | Form-scoped signed event subscriptions |
| `GET /api/v1/me` | any valid key | Key identity, scopes, quota state |

## Authentication

```http
Authorization: Bearer forms_live_<random secret>
```

- Generate at least 256 bits of randomness.
- Store only a slow hash or keyed hash of the secret, plus a non-secret `forms_live_...` prefix for lookup/display.
- Display the raw secret once at creation; never return it again.
- Keys are owner-scoped, named, scoped, revocable, rotatable, and audit logged.
- No API key, database URL, response token, password, or webhook secret is included in list/read responses.

## Data model additions

- `ApiKey`: owner, name, prefix, hash, scopes, last-used, expiry, revoked timestamp.
- `ApiAuditEvent`: key/action/resource/IP/request metadata/status (privacy-minimized).
- `WebhookEndpoint`: owner, optional form, URL, encrypted/hashed signing secret strategy, event set, enabled state.
- `WebhookDelivery`: event payload hash, status, attempts, next attempt, timestamps.

These require a reviewed PostgreSQL migration and must be separated from the incomplete historical migration baseline.

## Security requirements

1. Upstash Redis rate limits: per key + per owner + IP fallback, durable across Vercel instances.
2. Constant-time key verification and generic unauthorized responses.
3. Strict Zod request/query validation; pagination caps and bounded response sizes.
4. Every read/write is owner scoped in the database query, never merely checked after an unscoped lookup.
5. Programmatic response submission reuses the existing published/close date/question ownership/max-response enforcement.
6. Webhook URLs reject local/private address targets; sign payloads with timestamped HMAC; retry with exponential backoff and delivery logs.
7. Idempotency keys required for creates/submissions to prevent duplicate automation retries.
8. Versioned error envelope and request ID on every response.

## Developer experience

- Dashboard **Developers** destination: API keys, scopes, last used, rotation/revoke, webhook endpoints/deliveries.
- A public developer docs page: quick start, curl examples, scopes, errors, pagination, idempotency, webhook verification, changelog.
- Onboarding: create a test key, copy a sample request, see a real response in under two minutes.

## Release sequence

1. Add Upstash environment variables in Vercel: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
2. Add database migration/models and server-only key/webhook services.
3. Build dashboard key manager and internal API contract tests.
4. Add `/api/v1` endpoints behind an explicit public API feature flag.
5. Add integration/concurrency/webhook tests against disposable PostgreSQL + mocked Upstash.
6. Publish docs and enable feature flag only after rate-limit/audit/error monitoring is live.
