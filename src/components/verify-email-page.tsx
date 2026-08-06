'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/brand-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function VerifyEmailPage() {
  const token = useSearchParams().get('token') || '';
  const [message, setMessage] = useState(() => token ? 'Verifying your email…' : 'This verification link is invalid or expired.');
  const [failed, setFailed] = useState(() => !token);

  useEffect(() => {
    if (!token) return;
    void fetch('/api/auth/email-verification/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      setFailed(!response.ok);
      setMessage(body.message || body.error || 'Unable to verify email.');
    }).catch(() => {
      setFailed(true);
      setMessage('Network error. Please try again.');
    });
  }, [token]);

  return <main className="min-h-screen grid place-items-center bg-muted/20 p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center sm:items-start sm:text-left">
        <BrandMark className="mb-2 size-10" />
        <CardTitle>{failed ? 'Verification failed' : 'Email verification'}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent><a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/">Go to sign in</a></CardContent>
    </Card>
  </main>;
}
