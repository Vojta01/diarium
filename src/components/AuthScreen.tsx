"use client";

import { useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

export function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = createSupabaseClient();
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Přesměruje na Google OAuth → není potřeba volat onSignedIn
    } catch (e: any) {
      setError(e.message || "Nepodařilo se přihlásit");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Diarium
          </h1>
          <p className="text-white/30 text-sm mt-2">
            Tvůj denní check-in — teď s Google účtem
          </p>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800
                       hover:bg-gray-100 py-3 px-6 rounded-xl font-medium transition-colors
                       disabled:opacity-50 border border-white/10"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Přihlašuji..." : "Přihlásit přes Google"}
          </button>
        </div>

        <p className="text-white/15 text-[10px] text-center mt-6">
          Po přihlášení se vytvoří tvůj účet. Data jsou jen tvoje.
        </p>
      </div>
    </div>
  );
}
