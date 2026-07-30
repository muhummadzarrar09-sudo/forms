import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

/**
 * Standardized API error responses.
 *
 * Every error payload has the shape `{ error: string }`. Validation errors
 * additionally include `details` from Zod's `flatten()`. This prevents
 * clients from having to guess which shape to parse.
 */

/** 400 — Validation failed */
export function validationError(zodError: ZodError) {
  return NextResponse.json(
    { error: 'Validation failed', details: zodError.flatten() },
    { status: 400 }
  );
}

/** 400 — Bad request with a human-readable message */
export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** 401 — Not authenticated */
export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/** 403 — Authenticated but not authorized */
export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/** 404 — Resource not found */
export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** 429 — Rate limited */
export function rateLimited(retryAfter: number, message = 'Too many requests. Please try again later.') {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

/** 500 — Internal error (message intentionally generic) */
export function internalError(message = 'An unexpected error occurred') {
  return NextResponse.json({ error: message }, { status: 500 });
}
