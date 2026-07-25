import { NextRequest, NextResponse } from 'next/server';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REGISTER = 5;
const MAX_LOGIN = 20;

// in-memory store — resets on cold start, acceptable for edge middleware
const store = new Map<string, { count: number; resetAt: number }>();

function check(key: string, limit: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function proxy(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const { pathname } = request.nextUrl;

  if (pathname === '/api/auth/register' && request.method === 'POST') {
    const { allowed, retryAfter } = check(`register:${ip}`, MAX_REGISTER);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many registration attempts. Try again in ${retryAfter}s.` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
  }

  if (pathname.startsWith('/api/auth/callback/credentials') && request.method === 'POST') {
    const { allowed, retryAfter } = check(`login:${ip}`, MAX_LOGIN);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${retryAfter}s.` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/register', '/api/auth/callback/credentials'],
};
