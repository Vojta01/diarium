"use client";

import { useState, useEffect, Component, ReactNode } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { Dashboard } from "@/components/Dashboard";
import { StatsDashboard } from "@/components/StatsDashboard";
import { OnePageCheckIn } from "@/components/OnePageCheckIn";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { readStoredSession } from "@/lib/auth-storage";
import type { User } from "@supabase/supabase-js";

type View = "dashboard" | "checkin" | "stats";

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }> {
  state = { hasError: false, error: "" };
  static getDerivedStateFromError(e: Error) { return { hasError: true, error: e.message }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div style={{ padding: "2rem", background: "#0f0f23", color: "#ef4444", minHeight: "100vh" }}>
        <h2>Chyba</h2><pre>{this.state.error}</pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#6366f1", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Zkusit znovu</button>
      </div>;
    }
    return this.props.children;
  }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  const [checkinDate, setCheckinDate] = useState<string | null>(null);

  useEffect(() => {
    try {
      const session = readStoredSession();
      if (session?.user) {
        const u = { ...session.user };
        if (!u.email && session.access_token) {
          try {
            const payload = JSON.parse(atob(session.access_token.split(".")[1]));
            u.email = payload.email || "";
          } catch {}
        }
        setUser(u as User);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  if (loading) return <div style={{ padding: "2rem", background: "#0f0f23", minHeight: "100vh", color: "#a5b4fc" }}>Načítám…</div>;
  if (!user) return <AuthScreen onSignedIn={() => window.location.reload()} />;

  const navigateToCheckIn = (date: string) => { setCheckinDate(date); setView("checkin"); };

  return (
    <ErrorBoundary>
      <div style={{ minHeight: "100vh", background: "#0f0f23" }}>
        <LanguageSwitcher />
        <Dashboard onNavigateToCheckIn={navigateToCheckIn} onNavigateToStats={() => setView("stats")} />
        {view === "checkin" && <OnePageCheckIn initialDate={checkinDate} onSaveDone={() => setView("dashboard")} />}
        {view === "stats" && <StatsDashboard onNavigateToDate={navigateToCheckIn} />}
      </div>
    </ErrorBoundary>
  );
}
