"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { AuthScreen } from "@/components/AuthScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/shell/AppShell";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_NAV, parseNavFromSearch, type NavState } from "@/lib/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseAuthTokenKey } from "@/lib/supabase-ref";
import { clearUserLocalState } from "@/lib/local-state";

function doLogout() {
  clearUserLocalState(localStorage);
  // Also delete supabase cookies
  document.cookie.split(";").forEach((c) => {
    const [name] = c.trim().split("=");
    if (name && (name.includes("sb-") || name.includes("supabase"))) {
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  });
  // Try Supabase signOut
  try {
    createSupabaseClient().auth.signOut().catch(() => {});
  } catch {}
  // Full reload to get clean login screen
  window.location.reload();
}

export default function Home() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  // Deep links (?view=, ?edit=, ?sub=) are parsed on the first client render,
  // before any auth early return, so a stored session opens the requested
  // destination without a second render pass.
  const [nav] = useState<NavState>(() =>
    typeof window === "undefined"
      ? DEFAULT_NAV
      : parseNavFromSearch(window.location.search)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try manual localStorage first (set by callback page)
    const stored = localStorage.getItem(getSupabaseAuthTokenKey());
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.user) {
          // Ensure user has email — decode from JWT if missing
          if (!parsed.user.email && parsed.access_token) {
            try {
              const payload = JSON.parse(atob(parsed.access_token.split(".")[1]));
              parsed.user.email = payload.email || "";
            } catch {}
          }
          // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap reads the persisted session once on mount
          setUser(parsed.user as User);
          setLoading(false);
          return;
        }
      } catch {}
    }

    // Fallback: supabase-js (network call — safe-guarded)
    try {
      const sb = createSupabaseClient();
      sb.auth
        .getSession()
        .then(({ data }) => {
          setUser(data.session?.user ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));

      const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => {
        listener.subscription.unsubscribe();
      };
    } catch {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-lg">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <ErrorBoundary>
      <AppShell user={user} initialNav={nav} onLogout={doLogout} />
    </ErrorBoundary>
  );
}
