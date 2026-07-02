"use client";

import { useRef, useState, useCallback, useEffect } from "react";

declare global {
  interface Window {
    google?: {
      photos?: {
        picker?: {
          create: (opts: { clientId?: string; authToken: string }) => Promise<{
            open: () => Promise<{
              mediaItems?: Array<{ baseUrl: string; mimeType: string }>;
            }>;
          }>;
        };
      };
    };
  }
}

interface PhotoPickerProps {
  onPhotoSelected: (dataUrl: string | null) => void;
  currentPhoto: string | null;
}

export function PhotoPicker({ onPhotoSelected, currentPhoto }: PhotoPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [authToken] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("diarium_google_token")
      : null
  );
  const [pickerMode, setPickerMode] = useState<"menu" | "google" | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Compress and resize large images before converting to base64
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 1024;
        const maxH = 1024;
        let { width, height } = img;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        onPhotoSelected(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onPhotoSelected]
  );

  const handleGooglePhotos = useCallback(async () => {
    const token = localStorage.getItem("diarium_google_token");

    if (!token) {
      // Start OAuth flow — user needs to authorize
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        alert(
          "Google Photos není nakonfigurováno. Použijte prosím nahrání ze zařízení."
        );
        return;
      }
      const redirectUri = `${window.location.origin}/auth/google-callback`;
      const scope = "https://www.googleapis.com/auth/photoslibrary.readonly";
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(scope)}` +
        `&prompt=consent`;

      // Save current state so we come back to the right step
      sessionStorage.setItem("diarium_auth_pending", "true");
      window.location.href = authUrl;
      return;
    }

    // Try Google Photos Picker API via POST to proxy
    try {
      const res = await fetch(
        "https://photoslibrary.googleapis.com/v1/mediaItems:search",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pageSize: 20 }),
        }
      );

      if (!res.ok) {
        // Token expired — clear and fall back
        localStorage.removeItem("diarium_google_token");
        fileRef.current?.click();
        return;
      }

      const data = await res.json();
      if (data.mediaItems?.[0]) {
        // Take the first photo — we could build an actual gallery picker later
        onPhotoSelected(data.mediaItems[0].baseUrl + "=w1024-h1024");
      } else {
        alert("V Google Photos nebyly nalezeny žádné fotky.");
        fileRef.current?.click();
      }
    } catch {
      // Network error — fall back to device picker
      fileRef.current?.click();
    }
  }, [onPhotoSelected, authToken]);

  const clearPhoto = () => onPhotoSelected(null);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-glass flex items-center gap-2 text-sm px-3 py-2"
        >
          <span className="text-lg">📷</span>
          Zařízení
        </button>
        <button
          type="button"
          onClick={handleGooglePhotos}
          className="btn-glass flex items-center gap-2 text-sm px-3 py-2"
        >
          <span className="text-lg">🖼️</span>
          Google Photos
        </button>
        {currentPhoto && (
          <button
            type="button"
            onClick={clearPhoto}
            className="btn-glass flex items-center gap-1 text-sm px-3 py-2 text-red-400"
          >
            ✕ Odebrat
          </button>
        )}
      </div>

      {currentPhoto && (
        <div className="relative rounded-xl overflow-hidden border border-white/10">
          <img
            src={currentPhoto}
            alt="Vybraná fotka"
            className="w-full max-h-48 object-cover"
          />
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
