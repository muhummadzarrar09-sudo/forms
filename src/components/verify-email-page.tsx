'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function VerifyEmailPage() {
  const token = useSearchParams().get('token') || '';
  const [message, setMessage] = useState('Verifying your email…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) { setFailed(true); setMessage('This verification link is invalid or expired.'); return; }
    void fetch('/api/auth/email-verification/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      setFailed(!response.ok);
      setMessage(body.message || body.error || 'Unable to verify email.');
    }).catch(() => { setFailed(true); setMessage('Network error. Please try again.'); });
  }, [token]);

  return <main className="min-h-screen grid place-items-center bg-muted/20 p-4">
    <Card className="w-full max-w-md"><CardHeader><CardTitle>{failed ? 'Verification failed' : 'Email verification'}</CardTitle><CardDescription>{message}</CardDescription></CardHeader>
      <CardContent><a className="text-sm text-primary underline" href="/">Go to sign in</a></CardContent>
    </Card>
  </main>;
}
