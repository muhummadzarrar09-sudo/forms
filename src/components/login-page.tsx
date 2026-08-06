'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';

export function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetNotice, setResetNotice] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        // Refresh the session-backed shell without a full-document navigation.
        router.replace('/');
        router.refresh();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registerPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create the account
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          name: registerName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      // Step 2: Auto sign in after successful registration
      const result = await signIn('credentials', {
        email: registerEmail.trim().toLowerCase(),
        password: registerPassword,
        redirect: false,
      });

      if (result?.error) {
        // New accounts must verify ownership before a session is issued.
        setActiveTab('login');
        setError('Check your inbox and verify your email before signing in.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!loginEmail.trim()) return setError('Enter your email address first.');
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/email-verification/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail }),
      });
      const body = await response.json().catch(() => ({}));
      setError(body.message || body.error || 'If applicable, a verification link has been sent.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetNotice('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setError(body.error || 'Unable to request a password reset.');
      setResetNotice(body.message || 'If an account exists for this email, a password reset link will be sent.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo & Brand */}
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
          <p className="text-muted-foreground mt-1">
            Beautiful conversational forms
          </p>
        </div>

        <Card className="border-border/50 shadow-[var(--shadow-2)]">
          <CardHeader className="pb-4">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(''); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <CardTitle className="text-xl mt-4">Welcome back</CardTitle>
                <CardDescription>Sign in to your account to continue</CardDescription>
              </TabsContent>

              <TabsContent value="register">
                <CardTitle className="text-xl mt-4">Sign Up</CardTitle>
                <CardDescription>Create a free account to start building forms</CardDescription>
              </TabsContent>

              <TabsContent value="reset">
                <CardTitle className="text-xl mt-4">Reset password</CardTitle>
                <CardDescription>We will send a reset link if an account exists for your email.</CardDescription>
              </TabsContent>
            </Tabs>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(''); }} className="w-full">
              {/* Login Form */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
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
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg"
                    >
                      <AlertCircle className="size-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>

                  <div className="space-y-2 text-center text-sm">
                    <button type="button" className="block w-full text-primary hover:underline" onClick={() => { setActiveTab('reset'); setError(''); setResetNotice(''); }}>
                      Forgot your password?
                    </button>
                    <button type="button" className="block w-full text-primary hover:underline" onClick={handleResendVerification} disabled={isLoading}>
                      Resend verification email
                    </button>
                  </div>

                  <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium"
                      onClick={() => { setActiveTab('register'); setError(''); }}
                    >
                      Sign Up
                    </button>
                  </p>
                </form>
              </TabsContent>

              {/* Register Form */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Name (optional)</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="John Doe"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Minimum 12 characters"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        required
                        minLength={12}
                        autoComplete="new-password"
                        className="pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg"
                    >
                      <AlertCircle className="size-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        Creating account...
                      </>
                    ) : (
                      'Sign Up'
                    )}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium"
                      onClick={() => { setActiveTab('login'); setError(''); }}
                    >
                      Sign In
                    </button>
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="reset">
                <form onSubmit={handlePasswordResetRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input id="reset-email" type="email" autoComplete="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                  </div>
                  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                  {resetNotice && <p role="status" className="text-sm text-success">{resetNotice}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Sending reset link…' : 'Send reset link'}
                  </Button>
                  <button type="button" className="w-full text-center text-sm text-primary hover:underline" onClick={() => { setActiveTab('login'); setError(''); setResetNotice(''); }}>
                    Back to sign in
                  </button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Your forms, your data. Secure and private.
        </p>
      </motion.div>
    </div>
  );
}
