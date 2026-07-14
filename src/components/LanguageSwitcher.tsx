"use client";

import { useTranslation } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => setLang("cs")}
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
          lang === "cs"
            ? "bg-indigo-500/30 text-indigo-200 border border-indigo-400/30"
            : "text-white/25 hover:text-white/50 border border-transparent"
        }`}
        title="Čeština"
        aria-label="Přepnout na češtinu"
      >
        🇨🇿
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
          lang === "en"
            ? "bg-indigo-500/30 text-indigo-200 border border-indigo-400/30"
            : "text-white/25 hover:text-white/50 border border-transparent"
        }`}
        title="English"
        aria-label="Switch to English"
      >
        🇬🇧
      </button>
    </div>
  );
}
