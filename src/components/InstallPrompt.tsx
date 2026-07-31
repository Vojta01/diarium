"use client";

import { useEffect, useState } from "react";

/**
 * Shows an "Install App" button when the browser supports PWA installation
 * but hasn't shown the native prompt yet.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode (already installed)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also check if the app was installed via this prompt
    window.addEventListener("appinstalled", () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    // On Android Chrome, show prompt after a few seconds even if beforeinstallprompt hasn't fired
    const isAndroidChrome = /Android.*Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
    let timer: any;
    if (isAndroidChrome) {
      timer = setTimeout(() => {
        if (!deferredPrompt) setShowPrompt(true);
      }, 5000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback: show instructions for manual install
      alert("Otevři menu Chrome (⋮) → 'Přidat na plochu' nebo 'Instalovat aplikaci'");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="glass-card border-emerald-400/30 bg-emerald-950/90 p-4 flex items-center gap-3">
        <span className="text-2xl shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Nainstalovat aplikaci</p>
          <p className="text-white/40 text-xs mt-0.5">
            Přidej Diarium na plochu pro rychlý přístup
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
        >
          Instalovat
        </button>
      </div>
    </div>
  );
}
