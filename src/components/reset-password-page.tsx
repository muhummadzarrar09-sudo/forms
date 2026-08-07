'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandMark } from '@/components/brand-mark';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/components/auth-provider';

/** Supabase recovery links establish a short-lived session before this screen. */
export function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status, refresh } = useSupabaseAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The callback exchanges the PKCE code before arriving here. Refresh once
    // in case the provider mounted before the redirect cookies were observed.
    void refresh().catch(() => undefined);
  }, [refresh]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!user) return setError('Open a valid recovery link from your email before choosing a new password.');
    if (password.length < 12) return setError('Password must be at least 12 characters.');
    if (password !== confirmation) return setError('Passwords do not match.');

    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError('Unable to reset this password. Request a new recovery link and try again.');
        return;
      }

      setPassword('');
      setConfirmation('');
      setMessage('Password updated. You can continue to your workspace.');
      await refresh();
    } catch {
      setError('Unable to reset this password. Request a new recovery link and try again.');
    } finally {
      setSaving(false);
    }
  };

  const linkError = searchParams.get('error') === 'invalid_recovery_link';
  const ready = status === 'authenticated' && Boolean(user);

  return (
    <main className="min-h-screen grid place-items-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <BrandMark className="mb-2 size-10" />
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            {ready ? 'Choose a new password with at least 12 characters.' : 'Open the recovery link sent to your email to continue.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={!ready || saving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={!ready || saving} />
            </div>
            {(linkError || error) && <p role="alert" className="text-sm text-destructive">{error || 'This recovery link is invalid or expired. Request a new one from the sign-in screen.'}</p>}
            {message && <p role="status" className="text-sm text-success">{message}</p>}
            {message ? (
              <Button type="button" className="w-full" onClick={() => router.replace('/')}>Continue to Forms</Button>
            ) : (
              <Button className="w-full" disabled={saving || !ready}>{saving ? 'Updating…' : 'Update password'}</Button>
            )}
            {!ready && status !== 'loading' && !linkError && (
              <a className="block text-center text-sm font-medium text-primary hover:underline" href="/">Request a new recovery link</a>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
