"use client";

import { useState } from "react";

import { ExportDialog } from "@/components/ExportDialog";
import { ExternalLink } from "@/components/ExternalLink";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationSettingsButton } from "@/components/NotificationSettingsButton";
import { SectionHeader } from "@/components/ui/ScreenHeader";
import { AndroidIcon, GitHubIcon } from "@/components/ui/icons";
import { useTranslation } from "@/lib/i18n";
import {
  ANDROID_APK_URL,
  GITHUB_ANDROID_URL,
  GITHUB_WEB_URL,
} from "@/lib/links";
import type { SubScreen } from "@/lib/navigation";

interface SettingsViewProps {
  email?: string | null;
  onLogout: () => void;
  onOpenSub: (sub: SubScreen) => void;
}

/**
 * Interim Settings destination. Account, language, export, achievements and the
 * public links are real; the final Android-style Settings screen (notification
 * scheduling, AI reports, about/version) is a later phase.
 */
export function SettingsView({ email, onLogout, onOpenSub }: SettingsViewProps) {
  const { t } = useTranslation();
  const [showExport, setShowExport] = useState(false);

  const rowClass =
    "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-left text-sm text-[color:var(--text-1)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70";

  return (
    <div className="space-y-4">
      <section className="glass-card">
        <SectionHeader title={t("settings.account")} />
        <p className="truncate text-sm text-[color:var(--text-1)]">
          {email || t("settings.unknown_user")}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 min-h-11 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        >
          {t("settings.logout")}
        </button>
      </section>

      <section className="glass-card">
        <SectionHeader title={t("settings.language")} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--text-2)]">{t("settings.language_hint")}</p>
          <LanguageSwitcher />
        </div>
      </section>

      <section className="glass-card">
        <SectionHeader title={t("settings.data")} />
        <div className="divide-y divide-white/5">
          <button type="button" onClick={() => setShowExport(true)} className={rowClass}>
            <span>{t("settings.export")}</span>
            <span aria-hidden="true" className="text-[color:var(--text-3)]">
              ›
            </span>
          </button>
          <button
            type="button"
            onClick={() => onOpenSub("achievements")}
            className={rowClass}
          >
            <span>{t("nav.achievements")}</span>
            <span aria-hidden="true" className="text-[color:var(--text-3)]">
              ›
            </span>
          </button>
        </div>
      </section>

      <section className="glass-card">
        <SectionHeader title={t("settings.notifications")} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--text-2)]">
            {t("settings.notifications_hint")}
          </p>
          <NotificationSettingsButton />
        </div>
      </section>

      <section className="glass-card">
        <SectionHeader title={t("links.about")} />
        <button type="button" onClick={() => onOpenSub("about")} className={rowClass}>
          <span>{t("settings.about_app")}</span>
          <span aria-hidden="true" className="text-[color:var(--text-3)]">
            ›
          </span>
        </button>
        <div className="glass-divider my-2" aria-hidden="true" />
        <div className="space-y-1">
          <ExternalLink
            href={GITHUB_WEB_URL}
            label={t("links.github_source")}
            className="w-full justify-start"
          >
            <GitHubIcon size={18} />
            <span>{t("links.github_source")}</span>
          </ExternalLink>
          <ExternalLink
            href={GITHUB_ANDROID_URL}
            label={t("links.android")}
            className="w-full justify-start"
          >
            <AndroidIcon size={18} />
            <span>{t("links.android")}</span>
          </ExternalLink>
          <ExternalLink
            href={ANDROID_APK_URL}
            label={t("links.download_apk")}
            className="w-full justify-start"
          >
            <AndroidIcon size={18} />
            <span>{t("links.download_apk")}</span>
            <span className="text-[11px] text-[color:var(--text-3)]">
              {t("links.apk_hint")}
            </span>
          </ExternalLink>
        </div>
      </section>

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
    </div>
  );
}
