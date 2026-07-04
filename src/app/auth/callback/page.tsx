'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function decodeJWT(token: string) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function storeAndRedirect(access_token: string, refresh_token: string, expires_at?: number) {
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
  localStorage.setItem(
    'sb-vmqbslghzgfotwhzgawa-auth-token',
    JSON.stringify({ access_token, refresh_token, expires_at: exp, token_type: 'bearer', user })
  );

  return true;
}

function CallbackInner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      // ── Strategy 1: Implicit flow — token in URL hash ──
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        setDebug(d => [...d, 'Hash detected, trying implicit flow...']);
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const expires_at = parseInt(params.get('expires_at') || '0') || undefined;

        if (access_token && refresh_token) {
          setDebug(d => [...d, 'Tokens found in hash, storing...']);
          if (storeAndRedirect(access_token, refresh_token, expires_at)) {
            setDebug(d => [...d, 'Redirecting to / ...']);
            window.location.href = '/';
            return;
          }
          setError('Failed to decode JWT from hash tokens');
          return;
        }
        setDebug(d => [...d, `Hash present but no tokens. Params: ${Array.from(params.keys()).join(', ')}`]);
      }

      // ── Strategy 2: PKCE flow — code in query string ──
      const queryString = window.location.search;
      if (queryString) {
        setDebug(d => [...d, 'Query string detected, trying PKCE flow...']);
        const searchParams = new URLSearchParams(queryString);
        const code = searchParams.get('code');
        
        if (code) {
          setDebug(d => [...d, `Code found: ${code.substring(0, 10)}...`]);
          // For PKCE, we need the Supabase client to exchange the code
          // Dynamic import to avoid SSR issues
          try {
            const { createSupabaseClient } = await import('@/lib/supabase/client');
            const sb = createSupabaseClient();
            const { data, error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              setError(`PKCE exchange failed: ${exchangeError.message}`);
              return;
            }
            if (data.session) {
              setDebug(d => [...d, 'PKCE session established, redirecting...']);
              window.location.href = '/';
              return;
            }
            setError('PKCE exchange succeeded but no session returned');
          } catch (e: any) {
            setError(`PKCE exchange exception: ${e.message}`);
          }
          return;
        }
      }

      // ── Neither worked ──
      setDebug(d => [...d, 'No hash tokens and no query code found']);
      setError('No valid auth data found. Please try logging in again.');
    })();
  }, [router]);

  if (error) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', background: '#0f0f23', minHeight: '100vh', color: '#ef4444' }}>
        <p>Auth Error: {error}</p>
        <div style={{ color: '#a5b4fc', marginTop: '1rem', fontSize: '0.8rem' }}>
          {debug.map((d, i) => <p key={i}>{d}</p>)}
        </div>
        <a href="/" style={{ color: '#6366f1' }}>← Zpět na přihlášení</a>
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
      <div style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
        {debug.map((d, i) => <p key={i}>{d}</p>)}
      </div>
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
