"use client";

import type { ReactNode } from "react";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Compact actions rendered on the right (44px targets, icon buttons). */
  trailing?: ReactNode;
}

/**
 * Android-beta5 style screen header: accent bar + 26px bold title + subtitle.
 * Sub-screens use `SubScreenChrome` instead, which adds the back affordance.
 */
export function ScreenHeader({ title, subtitle, trailing }: ScreenHeaderProps) {
  return (
    <header className="screen-header relative z-[1] mb-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="screen-header__bar" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-[32px] tracking-[-0.3px] text-[color:var(--text-1)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[14px] leading-5 text-[color:var(--text-2)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {trailing ? (
          <div className="flex shrink-0 items-center gap-0.5 pt-1">{trailing}</div>
        ) : null}
      </div>
    </header>
  );
}

/** 11px uppercase section label with an optional trailing action. */
export function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[color:var(--text-2)]">
        {title}
      </h2>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
