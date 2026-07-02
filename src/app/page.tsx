"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MoodStep } from "@/components/MoodStep";
import { ActivityStep } from "@/components/ActivityStep";
import { HabitsStep } from "@/components/HabitsStep";
import { GratitudeStep } from "@/components/GratitudeStep";
import { SubmitStep } from "@/components/SubmitStep";
import { SetupScreen } from "@/components/SetupScreen";
import { StepIndicator } from "@/components/StepIndicator";
import { StatsDashboard } from "@/components/StatsDashboard";
import { loadDayEntry, savePartialCheckIn } from "@/lib/github";
import type { CheckInData } from "@/lib/types";

const MOOD_EMOJIS: Record<number, string> = {
  5: "😄",
  4: "🙂",
  3: "😐",
  2: "😟",
  1: "😡",
};

const DEFAULT_HABITS: Record<string, { emoji: string; label: string; abstinence: boolean }> = {
  cvičení: { emoji: "🏋️", label: "Cvičení", abstinence: false },
  alkohol: { emoji: "🍺", label: "Alkohol", abstinence: true },
  meditace: { emoji: "🧘", label: "Meditace", abstinence: false },
  čtení: { emoji: "📖", label: "Čtení", abstinence: false },
  zdrave_jidlo: { emoji: "🥗", label: "Zdravé jídlo", abstinence: false },
  piti_vody: { emoji: "💧", label: "Pití vody", abstinence: false },
  porno: { emoji: "🔞", label: "Porno", abstinence: true },
  masturbace: { emoji: "💦", label: "Masturbace", abstinence: true },
};

const STEPS = ["Nálada", "Aktivity", "Návyky", "Vděčnost", "Hotovo"];

type View = "checkin" | "stats";

const EMPTY_DATA: CheckInData = {
  mood: 0,
  moodEmoji: "",
  activities: [],
  habits: Object.fromEntries(
    Object.keys(DEFAULT_HABITS).map((k) => [k, false])
  ),
  gratitude: ["", "", ""],
  note: "",
  photoDataUrl: null,
};

export default function Home() {
  const [configured, setConfigured] = useState(false);
  const [view, setView] = useState<View>("checkin");
  const [step, setStep] = useState(0);
  const [data, setData] = useState<CheckInData>({ ...EMPTY_DATA });
  const [isExisting, setIsExisting] = useState(false);
  const [editDate, setEditDate] = useState<string | null>(null); // non-null = editing historical entry
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  // Helper: which steps have data
  const stepHasData = useCallback(
    (s: number): boolean => {
      switch (s) {
        case 0: return data.mood > 0;
        case 1: return data.activities.length > 0;
        case 2: return Object.values(data.habits).some((v) => v);
        case 3: return data.gratitude.some((g) => g.trim()) || data.note.trim() !== "" || data.photoDataUrl !== null;
        default: return false;
      }
    },
    [data]
  );

  // Auto-load today's entry on mount
  useEffect(() => {
    const token = localStorage.getItem("diarium_github_token");
    const repo = localStorage.getItem("diarium_repo");
    if (!token || !repo) { setLoading(false); setConfigured(false); return; }
    setConfigured(true);

    // Check for edit parameter
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get("edit");
    
    const loadDate = editParam || new Date().toISOString().split("T")[0];
    if (editParam) {
      setEditDate(editParam);
      setView("checkin");
    }

    loadDayEntry(token, repo, loadDate).then((entry) => {
      if (entry) {
        setData(entry);
        if (editParam) {
          setIsExisting(true);
          setStep(4); // Start at recap for editing
        } else {
          setIsExisting(true);
          if (entry.mood === 0) setStep(0);
          else if (entry.activities.length === 0) setStep(1);
          else if (!Object.values(entry.habits).some((v) => v)) setStep(2);
          else if (!entry.gratitude.some((g) => g.trim()) && !entry.note.trim()) setStep(3);
          else setStep(4);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Auto-save on data changes (debounced 3s)
  const doSave = useCallback((currentData: CheckInData, final: boolean) => {
    const token = localStorage.getItem("diarium_github_token");
    const repo = localStorage.getItem("diarium_repo");
    if (!token || !repo) return;

    const serialized = JSON.stringify(currentData);
    if (serialized === lastSaved.current && !final) return;
    lastSaved.current = serialized;

    savePartialCheckIn(token, repo, currentData, final).catch(() => {});
  }, []);

  // Debounced save when data changes
  useEffect(() => {
    if (!configured || loading || editDate) return; // don't auto-save when editing historical
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Only save if there's something to save
    if (data.mood > 0) {
      saveTimer.current = setTimeout(() => doSave(data, false), 3000);
    }
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data, configured, loading, editDate, doSave]);

  // Save on step change
  const goToStep = useCallback((s: number) => {
    setStep(s);
    // Force immediate save on step transition if mood is set
    if (data.mood > 0 && configured && !editDate) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      doSave(data, false);
    }
  }, [data, configured, editDate, doSave]);

  const handleConfigured = () => setConfigured(true);

  const setMood = (mood: number) => {
    setData((d) => ({ ...d, mood, moodEmoji: MOOD_EMOJIS[mood] }));
    setTimeout(() => goToStep(1), 400);
  };

  const toggleActivity = (activity: string) => {
    setData((d) => ({
      ...d,
      activities: d.activities.includes(activity)
        ? d.activities.filter((a) => a !== activity)
        : [...d.activities, activity],
    }));
  };

  const toggleHabit = (habit: string) => {
    setData((d) => ({
      ...d,
      habits: { ...d.habits, [habit]: !d.habits[habit] },
    }));
  };

  const setGratitude = (index: number, value: string) => {
    setData((d) => {
      const g = [...d.gratitude];
      g[index] = value;
      return { ...d, gratitude: g };
    });
  };

  const resetCheckIn = () => {
    setData({ ...EMPTY_DATA });
    setStep(0);
    setIsExisting(false);
    setEditDate(null);
    lastSaved.current = "";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-lg">Načítám...</div>
      </div>
    );
  }

  if (!configured) {
    return <SetupScreen onConfigured={handleConfigured} />;
  }

  if (view === "stats") {
    return (
      <div>
        <StatsDashboard />
        <div className="fixed bottom-0 left-0 right-0 flex border-t border-white/5 bg-black/80 backdrop-blur-xl">
          <button onClick={() => setView("checkin")} className="flex-1 py-3 text-center text-sm text-white/30">
            ✏️ Check-in
          </button>
          <button onClick={() => setView("stats")} className="flex-1 py-3 text-center text-sm text-white border-t-2 border-indigo-400">
            📊 Statistiky
          </button>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pb-20">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Diarium
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {editDate 
            ? "Upravuješ záznam z " + new Date(editDate).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
            : isExisting
              ? "Pokračuješ v dnešním zápise"
              : new Date().toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })
          }
        </p>
        {isExisting && !editDate && (
          <button onClick={resetCheckIn} className="text-[10px] text-white/20 hover:text-white/40 mt-1 transition-colors">
            začít znovu
          </button>
        )}
        {editDate && (
          <button onClick={resetCheckIn} className="text-[10px] text-white/20 hover:text-white/40 mt-1 transition-colors">
            zpět na dnešek
          </button>
        )}
      </header>

      <StepIndicator
        steps={STEPS}
        current={step}
        completed={[0,1,2,3].map(i => stepHasData(i))}
        onStepClick={(s) => goToStep(s)}
      />

      <div className="w-full max-w-md">
        {step === 0 && <MoodStep onSelect={setMood} selected={data.mood} />}
        {step === 1 && (
          <ActivityStep
            selected={data.activities}
            onToggle={toggleActivity}
            onNext={() => goToStep(2)}
            onBack={() => goToStep(0)}
          />
        )}
        {step === 2 && (
          <HabitsStep
            habits={data.habits}
            habitDefs={DEFAULT_HABITS}
            onToggle={toggleHabit}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
          />
        )}
        {step === 3 && (
          <GratitudeStep
            gratitude={data.gratitude}
            note={data.note}
            photo={data.photoDataUrl}
            onChangeGratitude={setGratitude}
            onChangeNote={(n) => setData((d) => ({ ...d, note: n }))}
            onPhotoChange={(url) => setData((d) => ({ ...d, photoDataUrl: url }))}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
          />
        )}
        {step === 4 && (
          <SubmitStep
            data={data}
            isExisting={isExisting}
            editDate={editDate}
            onBack={() => goToStep(3)}
            onDone={() => {
              doSave(data, true);
              resetCheckIn();
            }}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 flex border-t border-white/5 bg-black/80 backdrop-blur-xl">
        <button onClick={() => setView("checkin")} className="flex-1 py-3 text-center text-sm text-white border-t-2 border-indigo-400">
          ✏️ Check-in
        </button>
        <button onClick={() => setView("stats")} className="flex-1 py-3 text-center text-sm text-white/30 hover:text-white/50 transition-colors">
          📊 Statistiky
        </button>
      </div>
    </div>
  );
}
