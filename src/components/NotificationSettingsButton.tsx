"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

/**
 * Button that opens the NATIVE notification settings inside the Android app.
 * Only visible when running inside the Diarium Android wrapper
 * (window.AndroidBridge). In a plain browser/PWA it stays hidden — the web
 * has no local notification scheduler.
 */
export function NotificationSettingsButton() {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(typeof window !== "undefined" &&
      typeof (window as any).AndroidBridge?.openNotificationSettings === "function");
  }, []);

  if (!available) return null;

  return (
    <button
      onClick={() => (window as any).AndroidBridge.openNotificationSettings()}
      className="px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer text-white/25 hover:text-white/50 border border-transparent"
      title={t("notifications.settings_title")}
      aria-label={t("notifications.settings_title")}
    >
      🔔
    </button>
  );
}