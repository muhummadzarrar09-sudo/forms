/**
 * Lightweight CSRF protection for API routes.
 *
 * All mutating API requests from the React client send `Content-Type: application/json`.
 * HTML forms and cross-origin <img>/<script> injections cannot set this header without
 * triggering a CORS preflight. Enforcing it on all POST/PUT/PATCH/DELETE requests to
 * `/api/` is therefore a sufficient CSRF guard without needing a synchroniser token.
 *
 * Exceptions:
 *  - Public response submission endpoints (POST to /api/forms/[id]/responses)
 *    are unauthenticated and don't need CSRF protection.
 *  - NextAuth callback endpoints use their own CSRF token mechanism.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Paths exempt from Content-Type enforcement (public/unauthenticated). */
const EXEMPT_PATHS = [
  /^\/api\/auth\//,           // NextAuth has its own CSRF
  /^\/api\/health$/,          // read-only
  /^\/api\/forms\/[^/]+\/responses$/,  // public POST (unauthenticated)
];

function isExempt(pathname: string): boolean {
  return EXEMPT_PATHS.some((pattern) => pattern.test(pathname));
}

/**
 * Returns true if the request passes the CSRF check.
 * Call this from middleware; return 403 if it returns false.
 */
export function passesCsrfCheck(method: string, pathname: string, headers: Headers): boolean {
  // Safe methods never need CSRF protection.
  if (SAFE_METHODS.has(method.toUpperCase())) return true;

  // Exempt paths (public endpoints, NextAuth callbacks).
  if (isExempt(pathname)) return true;

  // Require Content-Type: application/json.  Browser-initiated cross-origin
  // form submissions always use `application/x-www-form-urlencoded`,
  // `multipart/form-data`, or `text/plain` — none of which the React client
  // ever sends.  A custom header like X-Requested-With would also work, but
  // Content-Type gives us the same protection without an extra header.
  const contentType = headers.get('content-type') || '';
  return contentType.includes('application/json');
}
