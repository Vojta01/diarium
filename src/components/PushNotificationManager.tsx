"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY =
  "BOTRxmOOG-mT7D59Gs8Em2i4B9mjxPgAcnl9Hf7kyZ99-P8RMetAFvx5mxf9TM6xfG1kDgb6G26c6DJo9fTWgDM";

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

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    // Check current permission state
    if (Notification.permission === "granted") {
      // Already granted — re-subscribe (handles SW updates)
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (!sub) {
            subscribeUser().then(() => setStatus("granted"));
          } else {
            setStatus("granted");
          }
        });
      });
    } else if (Notification.permission === "denied") {
      setStatus("denied");
    } else {
      // "default" — auto-request after a short delay
      const timer = setTimeout(() => {
        subscribeUser().then((sub) => {
          setStatus(sub ? "granted" : "denied");
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Silent component — no UI needed, just handles subscription
  return null;
}
