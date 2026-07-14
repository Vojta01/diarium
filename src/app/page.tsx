"use client";

import { useState, useEffect } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { Dashboard } from "@/components/Dashboard";
import { StatsDashboard } from "@/components/StatsDashboard";
import { OnePageCheckIn } from "@/components/OnePageCheckIn";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseAuthTokenKey } from "@/lib/supabase-ref";
import type { User } from "@supabase/supabase-js";

type View = "dashboard" | "checkin" | "stats";

function doLogout() {
  // Clear ALL supabase auth data from localStorage
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith("sb-") || key.includes("supabase")) {
      localStorage.removeItem(key);
    }
  }
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
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  const [checkinDate, setCheckinDate] = useState<string | null>(null);

  useEffect(() => {
    // Try manual localStorage first (set by callback page)
    const stored = localStorage.getItem(getSupabaseAuthTokenKey());
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.user) {
          setUser(parsed.user as User);
          setLoading(false);
          return;
        }
      } catch {}
    }

    // Fallback: supabase-js
    const sb = createSupabaseClient();
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const params = new URLSearchParams(window.location.search);
    const editDate = params.get("edit");
    if (editDate) {
      setCheckinDate(editDate);
      setView("checkin");
    }

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const navigateToCheckIn = (date: string) => {
    setCheckinDate(date);
    setView("checkin");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-lg">Načítám...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSignedIn={() => {}} />;
  }

  // ── Bottom Tab Bar ──
  const TabBar = () => (
    <div className="fixed bottom-0 left-0 right-0 flex border-t border-white/5 bg-black/80 backdrop-blur-xl z-30">
      <button
        onClick={() => { setCheckinDate(null); setView("dashboard"); }}
        className={`flex-1 py-3 text-center text-sm transition-colors ${
          view === "dashboard"
            ? "text-white border-t-2 border-indigo-400"
            : "text-white/30 hover:text-white/50"
        }`}
      >
        🏠 Dashboard
      </button>
      <button
        onClick={() => { setCheckinDate(null); setView("checkin"); }}
        className={`flex-1 py-3 text-center text-sm transition-colors ${
          view === "checkin"
            ? "text-white border-t-2 border-indigo-400"
            : "text-white/30 hover:text-white/50"
        }`}
      >
        ✏️ Check-in
      </button>
      <button
        onClick={() => setView("stats")}
        className={`flex-1 py-3 text-center text-sm transition-colors ${
          view === "stats"
            ? "text-white border-t-2 border-indigo-400"
            : "text-white/30 hover:text-white/50"
        }`}
      >
        📊 Statistiky
      </button>
    </div>
  );

  if (view === "dashboard") {
    return (
      <div>
        <Dashboard onNavigateToCheckIn={navigateToCheckIn} onNavigateToStats={() => setView("stats")} />
        <TabBar />
      </div>
    );
  }

  if (view === "stats") {
    return (
      <div>
        <StatsDashboard onNavigateToDate={navigateToCheckIn} />
        <TabBar />
      </div>
    );
  }

  return (
    <div>
      {/* Header with logout */}
      <header className="text-center pt-4 pb-1 relative z-20">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Diarium
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-white/20 text-xs">{user.email}</span>
          <button
            onClick={doLogout}
            className="text-white/30 text-xs hover:text-red-400 transition-colors cursor-pointer border border-white/10 rounded px-2 py-0.5 hover:border-red-400/30"
          >
            odhlásit
          </button>
        </div>
      </header>

      <OnePageCheckIn
        initialDate={checkinDate}
        onSaveDone={() => {
          setCheckinDate(null);
          setView("stats");
        }}
      />

      <TabBar />
    </div>
  );
}
