"use client";

import { useEffect, type ReactNode } from "react";

import { useTranslation } from "@/lib/i18n";
import { ChevronLeftIcon } from "@/components/ui/icons";

interface SubScreenChromeProps {
  title: string;
  subtitle?: string;
  /** Returns to the parent tab (Android back behaviour). */
  onBack: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}

/**
 * Chrome shared by every sub-screen that lives outside the bottom bar
 * (goals, scales, templates, achievements, reports, export).
 */
export function SubScreenChrome({
  title,
  subtitle,
  onBack,
  trailing,
  children,
}: SubScreenChromeProps) {
  const { t } = useTranslation();

  // Android back parity: Escape leaves the sub-screen. Dialogs handle their
  // own Escape first and mark the event as handled, so they are skipped.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      const target = event.target;
      if (target instanceof Element && target.closest('[role="dialog"]')) return;

      event.preventDefault();
      onBack();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  return (
    <section className="relative z-[1] pb-2">
      <div className="sticky top-0 z-20 -mx-4 -mt-3 mb-4 flex items-center gap-2 border-b border-white/5 bg-[#07070b]/90 px-4 pb-3 pt-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("nav.back")}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[21px] font-semibold leading-7 text-[color:var(--text-1)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[13px] leading-[18px] text-[color:var(--text-2)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {trailing ? (
          <div className="flex shrink-0 items-center gap-1">{trailing}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
