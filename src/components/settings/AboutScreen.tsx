"use client";

import { ExternalLink } from "@/components/ExternalLink";
import { SectionHeader } from "@/components/ui/ScreenHeader";
import { AndroidIcon, GitHubIcon } from "@/components/ui/icons";
import { WEB_PACKAGE_NAME, WEB_VERSION } from "@/lib/app-meta";
import { useTranslation } from "@/lib/i18n";
import {
  ANDROID_APK_URL,
  GITHUB_ANDROID_URL,
  GITHUB_WEB_URL,
} from "@/lib/links";

/**
 * Real About sub-screen: identity, honest web/Android parity, the build
 * version from package.json and the public GitHub/APK links. No fake build
 * dates or invented stats.
 */
export function AboutScreen() {
  const { t } = useTranslation();

  const linkClass = "w-full justify-start";

  return (
    <div className="space-y-4">
      <section className="glass-card">
        <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[color:var(--text-2)]">
          {t("about.app_name")}
        </p>
        <h2 className="mt-1 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-3xl font-bold text-transparent">
          Diarium
        </h2>
        <p className="mt-1 font-mono text-[13px] text-[color:var(--text-3)]">
          {t("about.version", {
            package: WEB_PACKAGE_NAME,
            version: WEB_VERSION,
          })}
        </p>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">
          {t("about.parity")}
        </p>
      </section>

      <section className="glass-card">
        <SectionHeader title={t("about.links")} />
        <div className="space-y-1">
          <ExternalLink
            href={GITHUB_WEB_URL}
            label={t("links.github_source")}
            className={linkClass}
          >
            <GitHubIcon size={18} />
            <span>{t("links.github_source")}</span>
          </ExternalLink>
          <ExternalLink
            href={GITHUB_ANDROID_URL}
            label={t("links.android")}
            className={linkClass}
          >
            <AndroidIcon size={18} />
            <span>{t("links.android")}</span>
          </ExternalLink>
          <ExternalLink
            href={ANDROID_APK_URL}
            label={t("links.download_apk")}
            className={linkClass}
          >
            <AndroidIcon size={18} />
            <span>{t("links.download_apk")}</span>
            <span className="text-[11px] text-[color:var(--text-3)]">
              {t("links.apk_hint")}
            </span>
          </ExternalLink>
        </div>
      </section>

      <section className="glass-card">
        <SectionHeader title={t("about.data_ai_title")} />
        <p className="text-sm leading-6 text-[color:var(--text-2)]">
          {t("about.data_ai")}
        </p>
        <p className="mt-3 text-xs leading-5 text-[color:var(--text-3)]">
          {t("about.license")}
        </p>
      </section>
    </div>
  );
}
