"use client";

import { useState, useEffect } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { StatsDashboard } from "@/components/StatsDashboard";
import { OnePageCheckIn } from "@/components/OnePageCheckIn";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type View = "checkin" | "stats";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("checkin");
  const [loading, setLoading] = useState(true);
  const [checkinDate, setCheckinDate] = useState<string | null>(null);

  useEffect(() => {
    const sb = createSupabaseClient();

    // Zkontroluj existující session
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    // Poslouchej změny auth stavu
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Handle ?edit=YYYY-MM-DD from Calendar
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

  if (view === "stats") {
    return (
      <div>
        <StatsDashboard onNavigateToDate={navigateToCheckIn} />
        <div className="fixed bottom-0 left-0 right-0 flex border-t border-white/5 bg-black/80 backdrop-blur-xl">
          <button
            onClick={() => {
              setCheckinDate(null);
              setView("checkin");
            }}
            className="flex-1 py-3 text-center text-sm text-white/30"
          >
            ✏️ Check-in
          </button>
          <button
            onClick={() => setView("stats")}
            className="flex-1 py-3 text-center text-sm text-white border-t-2 border-indigo-400"
          >
            📊 Statistiky
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="text-center pt-4 pb-1">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Diarium
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-white/20 text-xs">
            {user.email}
          </span>
          <button
            onClick={async () => {
              await createSupabaseClient().auth.signOut();
            }}
            className="text-white/15 text-xs hover:text-white/40 transition-colors"
          >
            (odhlásit)
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
      <div className="fixed bottom-16 left-0 right-0 flex border-t border-white/5 bg-black/80 backdrop-blur-xl">
        <button
          onClick={() => setView("checkin")}
          className="flex-1 py-3 text-center text-sm text-white border-t-2 border-indigo-400"
        >
          ✏️ Check-in
        </button>
        <button
          onClick={() => setView("stats")}
          className="flex-1 py-3 text-center text-sm text-white/30 hover:text-white/50 transition-colors"
        >
          📊 Statistiky
        </button>
      </div>
    </div>
  );
}
