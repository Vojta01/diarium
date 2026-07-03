'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (!code) {
      setError('No auth code in URL');
      return;
    }

    const supabase = createSupabaseClient();

    supabase.auth.exchangeCodeForSession(code).then(({ data, error: exchangeError }) => {
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }
      console.log('Session established', data.session?.user?.email);
      router.replace('/');
    });
  }, [searchParams, router]);

  if (error) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#ef4444' }}>
        <p>Auth Error: {error}</p>
        <a href="/" style={{ color: '#6366f1' }}>← Zpět na přihlášení</a>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#0f0f23',
      color: '#a5b4fc',
      fontFamily: 'monospace',
    }}>
      Probíhá přihlašování...
    </div>
  );
}
