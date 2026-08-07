'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * This application is currently a private, single-owner workspace. New account
 * creation is deliberately disabled during the legacy-account cutover: letting
 * a browser create auth.users rows before the server creates the matching
 * legacy ownership record would create orphaned accounts.
 */
export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      if (signInError) {
        setError('Invalid email or password. If this is your migrated account, use password recovery first.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordResetRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      // Keep this response membership-neutral. Supabase may intentionally return
      // an indistinguishable success response for an unknown address.
      await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase(), { redirectTo });
      setNotice('If an account exists for this email, a password recovery link has been sent.');
    } catch {
      setNotice('If an account exists for this email, a password recovery link has been sent.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'reset') => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  const resetView = mode === 'reset';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mb-4 inline-flex"
          >
            <BrandMark className="size-14" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
          <p className="text-muted-foreground mt-1">Beautiful conversational forms</p>
        </div>

        <Card className="border-border/50 shadow-[var(--shadow-2)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {resetView ? 'Reset your password' : 'Welcome back'}
            </CardTitle>
            <CardDescription>
              {resetView
                ? 'We will send a recovery link if this email has an account.'
                : 'Sign in to continue to your private workspace.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {resetView ? (
              <form onSubmit={handlePasswordResetRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {error && <StatusMessage kind="error">{error}</StatusMessage>}
                {notice && <StatusMessage kind="notice">{notice}</StatusMessage>}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="size-4 animate-spin mr-2" />Sending recovery link…</> : 'Send recovery link'}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm font-medium text-primary hover:underline"
                  onClick={() => switchMode('login')}
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && <StatusMessage kind="error">{error}</StatusMessage>}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="size-4 animate-spin mr-2" />Signing in…</> : 'Sign in'}
                </Button>

                <button
                  type="button"
                  className="block w-full text-center text-sm font-medium text-primary hover:underline"
                  onClick={() => switchMode('reset')}
                >
                  Forgot your password?
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          This workspace is private. Account provisioning is managed by its owner.
        </p>
      </motion.div>
    </div>
  );
}

function StatusMessage({ children, kind }: { children: React.ReactNode; kind: 'error' | 'notice' }) {
  const isError = kind === 'error';
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      role={isError ? 'alert' : 'status'}
      className={`flex items-center gap-2 rounded-lg p-3 text-sm ${isError ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-foreground'}`}
    >
      {isError && <AlertCircle className="size-4 shrink-0" />}
      {children}
    </motion.div>
  );
}
