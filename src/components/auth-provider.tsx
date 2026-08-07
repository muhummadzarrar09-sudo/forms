'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SupabaseAuthContextValue = {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

/**
 * Keeps only the Supabase Auth session in client state. Application records are
 * never read from browser tables; protected API routes independently verify the
 * Auth cookie before they use a server-only service-role data client.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const [{ data: sessionData }, { data: userData, error }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);

    if (error || !userData.user) {
      setSession(null);
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    setSession(sessionData.session);
    setUser(userData.user);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    const initialize = async () => {
      try {
        const [{ data: sessionData }, { data: userData, error }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ]);
        if (!active) return;
        if (error || !userData.user) {
          setSession(null);
          setUser(null);
          setStatus('unauthenticated');
          return;
        }
        setSession(sessionData.session);
        setUser(userData.user);
        setStatus('authenticated');
      } catch {
        if (!active) return;
        setSession(null);
        setUser(null);
        setStatus('unauthenticated');
      }
    };
    void initialize();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStatus(nextSession?.user ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setSession(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<SupabaseAuthContextValue>(() => ({
    session,
    user,
    status,
    refresh,
    signOut,
  }), [refresh, session, signOut, status, user]);

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error('useSupabaseAuth must be used inside AuthProvider');
  return context;
}
