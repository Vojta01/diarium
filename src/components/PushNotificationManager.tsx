"use client";

import { useEffect, useState, useCallback } from "react";

const VAPID_PUBLIC_KEY =
  "BDQqhS8ckDCRGmoE6gfdRsoM9rGTbP9188B_Ue-XpHV3oNG9bbkG3rpLLONLwVT3D_mJFEhAjzhE2inp_hc0POY";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function subscribeUser(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push not supported");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("Notification permission denied");
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
  });

  // Send to backend
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });

  return subscription;
}

export function PushNotificationManager() {
  const [status, setStatus] = useState<"loading" | "granted" | "denied" | "unsupported">("loading");
  const [showPrompt, setShowPrompt] = useState(false);

  const checkAndSubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "granted") {
      // Always re-subscribe with current VAPID key to avoid mismatch after rotation
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      // Unsubscribe old subscription (wrong VAPID key)
      if (sub) {
        try { await sub.unsubscribe(); } catch {}
      }

      // Subscribe fresh with current key
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
        });
      } catch {
        setStatus("denied");
        return;
      }

      // Always send the subscription to server (may have been lost due to middleware/auth issues)
      try {
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        });
        if (!res.ok) console.error("[Push] Subscribe failed:", res.status, await res.text());
        else console.log("[Push] Subscription stored OK");
      } catch (e) {
        console.error("[Push] Subscribe network error:", e);
      }
      
      setStatus("granted");
    } else if (Notification.permission === "denied") {
      setStatus("denied");
    } else {
      // "default" — show prompt after delay
      setStatus("loading");
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    checkAndSubscribe();

    // Re-check when SW controller changes (new version activated)
    const onControllerChange = () => {
      console.log("[Push] SW controller changed, re-checking subscription...");
      checkAndSubscribe();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, [checkAndSubscribe]);

  const handleEnable = async () => {
    setShowPrompt(false);
    const sub = await subscribeUser();
    setStatus(sub ? "granted" : "denied");
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setStatus("denied");
  };

  if (status === "loading" && !showPrompt) return null;
  if (status === "unsupported") return null;

  if (showPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
        <div className="glass-card border-indigo-400/30 bg-indigo-950/90 p-4">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">
                Denní připomenutí
              </p>
              <p className="text-white/40 text-xs mt-0.5">
                Dostávej upozornění ve 21:00, ať nezapomeneš na check-in
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEnable}
              className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Povolit notifikace
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/30 hover:text-white/50 transition-colors text-sm cursor-pointer"
            >
          </button>
          </div>
        </div>
      </div>
    );
  }

  // Small status indicator in bottom-right
  return (
    <div className="fixed bottom-24 right-4 z-40">
      <div
        className={`w-3 h-3 rounded-full ${
          status === "granted" ? "bg-emerald-400" : "bg-red-400/50"
        }`}
        title={
          status === "granted"
            ? "Notifikace aktivní ✅"
            : "Notifikace vypnuté ❌ — pro zapnutí obnov aplikaci"
        }
      />
    </div>
  );
}
