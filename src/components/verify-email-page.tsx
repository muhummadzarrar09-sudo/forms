'use client';

import { BrandMark } from '@/components/brand-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Legacy custom-email tokens are retired during the Supabase Auth cutover.
 * Supabase handles confirmation and recovery links through /auth/callback.
 */
export function VerifyEmailPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center sm:items-start sm:text-left">
          <BrandMark className="mb-2 size-10" />
          <CardTitle>Email verification moved</CardTitle>
          <CardDescription>
            This workspace now uses Supabase Auth for account verification and password recovery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/">Go to sign in</a>
        </CardContent>
      </Card>
    </main>
  );
}
