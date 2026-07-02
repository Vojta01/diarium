"use client";

import { useState, useEffect } from "react";
import { MoodStep } from "@/components/MoodStep";
import { ActivityStep } from "@/components/ActivityStep";
import { HabitsStep } from "@/components/HabitsStep";
import { GratitudeStep } from "@/components/GratitudeStep";
import { SubmitStep } from "@/components/SubmitStep";
import { SetupScreen } from "@/components/SetupScreen";
import { StepIndicator } from "@/components/StepIndicator";
import { StatsDashboard } from "@/components/StatsDashboard";
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

export default function Home() {
  const [configured, setConfigured] = useState(false);
  const [view, setView] = useState<View>("checkin");
  const [step, setStep] = useState(0);
  const [data, setData] = useState<CheckInData>({
    mood: 0,
    moodEmoji: "",
    activities: [],
    habits: Object.fromEntries(
      Object.keys(DEFAULT_HABITS).map((k) => [k, false])
    ),
    gratitude: ["", "", ""],
    note: "",
    photoDataUrl: null,
  });

  useEffect(() => {
    const token = localStorage.getItem("diarium_github_token");
    const repo = localStorage.getItem("diarium_repo");
    if (token && repo) setConfigured(true);
  }, []);

  const handleConfigured = () => setConfigured(true);

  const setMood = (mood: number) => {
    setData((d) => ({ ...d, mood, moodEmoji: MOOD_EMOJIS[mood] }));
    setTimeout(() => setStep(1), 400);
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

  if (!configured) {
    return <SetupScreen onConfigured={handleConfigured} />;
  }

  if (view === "stats") {
    return (
      <div>
        <StatsDashboard />
        {/* Bottom tab bar */}
        <div className="fixed bottom-0 left-0 right-0 flex border-t border-white/5 bg-black/80 backdrop-blur-xl safe-area-bottom">
          <button
            onClick={() => { setView("checkin"); setStep(0); }}
            className="flex-1 py-3 text-center text-sm text-white/30 hover:text-white/50 transition-colors"
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pb-20">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Diarium
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {new Date().toLocaleDateString("cs-CZ", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </header>

      <StepIndicator steps={STEPS} current={step} />

      <div className="w-full max-w-md">
        {step === 0 && <MoodStep onSelect={setMood} selected={data.mood} />}
        {step === 1 && (
          <ActivityStep
            selected={data.activities}
            onToggle={toggleActivity}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <HabitsStep
            habits={data.habits}
            habitDefs={DEFAULT_HABITS}
            onToggle={toggleHabit}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
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
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <SubmitStep
            data={data}
            onBack={() => setStep(3)}
            onDone={() => {
              setStep(0);
              setData({
                mood: 0,
                moodEmoji: "",
                activities: [],
                habits: Object.fromEntries(
                  Object.keys(DEFAULT_HABITS).map((k) => [k, false])
                ),
                gratitude: ["", "", ""],
                note: "",
                photoDataUrl: null,
              });
            }}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 flex border-t border-white/5 bg-black/80 backdrop-blur-xl">
        <button
          onClick={() => { setView("checkin"); setStep(0); }}
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
