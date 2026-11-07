"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { uploadCheckInPhoto } from "@/lib/supabase/db";
import { isCheckInError } from "@/lib/checkin/errors";
import { compressPhoto, validatePhotoFile } from "@/lib/checkin/photo";

interface PhotoPickerProps {
  /** Receives the public Storage URL, or null when the photo is removed. */
  onPhotoSelected: (url: string | null) => void;
  currentPhoto: string | null;
  date: string;
  /** True when the stored value is a legacy base64 photo that must be re-uploaded. */
  legacyPhoto?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  /** Receives an i18n key, or null when the error is cleared. */
  onError?: (messageKey: string | null) => void;
}

export function PhotoPicker({
  onPhotoSelected,
  currentPhoto,
  date,
  legacyPhoto = false,
  onUploadingChange,
  onError,
}: PhotoPickerProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateRef = useRef(date);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  const setUploadingState = useCallback(
    (value: boolean) => {
      setUploading(value);
      onUploadingChange?.(value);
    },
    [onUploadingChange]
  );

  const reportError = useCallback(
    (messageKey: string | null) => {
      setError(messageKey);
      onError?.(messageKey);
    },
    [onError]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset immediately so picking the same file twice still fires change.
      event.target.value = "";
      if (!file) return;

      const validation = validatePhotoFile(file);
      if (validation) {
        reportError(validation);
        return;
      }

      const uploadDate = dateRef.current;
      reportError(null);
      setUploadingState(true);
      try {
        const blob = await compressPhoto(file);
        const url = await uploadCheckInPhoto(blob, uploadDate);
        // The user changed the date while the upload was in flight; discard the
        // result rather than attaching yesterday's photo to today's entry.
        if (uploadDate !== dateRef.current) return;
        onPhotoSelected(url);
      } catch (uploadError) {
        reportError(
          isCheckInError(uploadError)
            ? uploadError.code
            : "checkin.photo_error_upload"
        );
      } finally {
        setUploadingState(false);
      }
    },
    [onPhotoSelected, reportError, setUploadingState]
  );

  const removePhoto = () => {
    reportError(null);
    onPhotoSelected(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className="btn-glass flex items-center gap-2 text-sm px-3 py-2 disabled:opacity-50"
        >
          <span className="text-lg">📷</span>
          {t("checkin.photo_camera")}
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={uploading}
          className="btn-glass flex items-center gap-2 text-sm px-3 py-2 disabled:opacity-50"
        >
          <span className="text-lg">🖼️</span>
          {t("checkin.photo_gallery")}
        </button>
        {currentPhoto && !uploading && (
          <button
            type="button"
            onClick={removePhoto}
            className="btn-glass flex items-center gap-1 text-sm px-3 py-2 text-red-400"
          >
            {t("checkin.photo_remove")}
          </button>
        )}
      </div>

      {uploading && (
        <p className="text-xs text-white/40" role="status">
          {t("checkin.photo_uploading")}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-300" role="alert">
          {t(error)}
        </p>
      )}

      {legacyPhoto && !currentPhoto && (
        <p className="text-xs text-amber-300/80" role="status">
          {t("checkin.photo_legacy")}
        </p>
      )}

      {currentPhoto ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10">
          <img
            src={currentPhoto}
            alt={t("photoPicker.selected_photo_alt")}
            className="w-full max-h-48 object-cover"
          />
        </div>
      ) : (
        !uploading && (
          <p className="text-xs text-white/25 italic">{t("checkin.photo_empty")}</p>
        )
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={t("checkin.photo_camera")}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t("checkin.photo_gallery")}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
