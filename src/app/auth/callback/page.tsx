'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseAuthTokenKey } from '@/lib/supabase-ref';

function decodeJWT(token: string) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

async function storeAndSetSession(access_token: string, refresh_token: string, expires_at?: number) {
  // Decode JWT to get user info
  const payload = decodeJWT(access_token);
  if (!payload) return false;

  const user = {
    id: payload.sub,
    email: payload.email,
    user_metadata: payload.user_metadata || {},
    app_metadata: payload.app_metadata || {},
    aud: payload.aud || 'authenticated',
    role: payload.role || 'authenticated',
  };

  const exp = expires_at || Math.floor(Date.now() / 1000) + 3600;

  // Store in localStorage (for client-side use)
  localStorage.setItem(
    getSupabaseAuthTokenKey(),
    JSON.stringify({ access_token, refresh_token, expires_at: exp, token_type: 'bearer', user })
  );

  // Also set session via Supabase client (sets cookies for middleware)
  try {
    const { createSupabaseClient } = await import('@/lib/supabase/client');
    const sb = createSupabaseClient();
    await sb.auth.setSession({ access_token, refresh_token });
  } catch {
    // Cookie-based auth failed, but localStorage works for client-side
    console.warn('Failed to set Supabase session cookies, falling back to localStorage-only auth');
  }

  return true;
}

function CallbackInner() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // ── Strategy 1: Implicit flow — token in URL hash ──
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const expires_at = parseInt(params.get('expires_at') || '0') || undefined;

        if (access_token && refresh_token) {
          if (await storeAndSetSession(access_token, refresh_token, expires_at)) {
            window.location.href = '/';
            return;
          }
          setError('Failed to decode the sign-in token. Please try logging in again.');
          return;
        }
      }

      // ── Strategy 2: PKCE flow — code in query string ──
      const queryString = window.location.search;
      if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        const code = searchParams.get('code');

        if (code) {
          try {
            const { createSupabaseClient } = await import('@/lib/supabase/client');
            const sb = createSupabaseClient();
            const { data, error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              setError('Sign-in link could not be verified. Please try logging in again.');
              return;
            }
            if (data.session) {
              window.location.href = '/';
              return;
            }
            setError('Sign-in link was accepted but no session was created. Please try again.');
          } catch {
            setError('Sign-in link could not be verified. Please try logging in again.');
          }
          return;
        }
      }

      // ── Neither worked ──
      setError('No valid auth data found. Please try logging in again.');
    })();
  }, []);

  if (error) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', background: '#0f0f23', minHeight: '100vh', color: '#ef4444' }}>
        <p>Auth Error: {error}</p>
        <Link href="/" style={{ color: '#6366f1' }}>← Zpět na přihlášení</Link>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#0f0f23',
      color: '#a5b4fc',
      fontFamily: 'monospace',
    }}>
      <p>Probíhá přihlašování...</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f0f23' }} />}>
      <CallbackInner />
    </Suspense>
  );
}
