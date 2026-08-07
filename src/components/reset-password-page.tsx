'use client';

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandMark } from '@/components/brand-mark';

export function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!token) return setError('This reset link is invalid or expired.');
    if (password.length < 12) return setError('Password must be at least 12 characters.');
    if (password !== confirmation) return setError('Passwords do not match.');

    setSaving(true);
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setError(body.error || 'Unable to reset password.');
      setMessage('Password reset successfully. You can now sign in.');
      setPassword('');
      setConfirmation('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <main className="min-h-screen grid place-items-center bg-muted/20 p-4">
    <Card className="w-full max-w-md">
      <CardHeader>
        <BrandMark className="mb-2 size-10" />
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Choose a new password with at least 12 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="text-sm text-success">{message} <a className="underline" href="/">Sign in</a></p>}
          <Button className="w-full" disabled={saving || Boolean(message)}>{saving ? 'Resetting…' : 'Reset password'}</Button>
        </form>
      </CardContent>
    </Card>
  </main>;
}
