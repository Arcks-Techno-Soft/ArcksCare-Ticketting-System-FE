"use client";

/**
 * SerialPhotoField — the required photo of the device's serial-number label.
 *
 * Typed serials arrive wrong often enough that POS and printer tickets now ask
 * for a picture of the label as well, so the team can read the number off the
 * device itself when the typed one doesn't match the registry. One image, not
 * the general attachments list: it has to be obvious that this specific photo
 * is what's being asked for.
 */
import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — a phone photo, not a video
const ACCEPTED = ["image/jpeg", "image/png", "image/heic", "image/heif"];
const ACCEPT_ATTR = ".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif";

type Props = {
  value: File | null;
  onChange: (file: File | null) => void;
  /** Validation message from the parent's submit check. */
  error?: string | null;
};

export function SerialPhotoField({ value, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Object URLs must be revoked or the blob leaks for the page's lifetime.
  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const accept = (file: File | undefined) => {
    setLocalError(null);
    if (!file) return;
    // HEIC from iPhones sometimes arrives with an empty type; fall back to the
    // extension rather than rejecting a legitimate photo.
    const byExt = /\.(jpe?g|png|heic|heif)$/i.test(file.name);
    if (file.type && !ACCEPTED.includes(file.type) && !byExt) {
      setLocalError("That file isn't an image. Use a JPG, PNG or HEIC photo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("That photo is over 10 MB. Try again with a smaller one.");
      return;
    }
    onChange(file);
  };

  const shown = error ?? localError;

  return (
    <div className="mt-3">
      <p className="text-[12.5px] font-medium text-ink">
        Photo of the serial number label <span className="text-accent-danger">*</span>
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-subtle">
        Take a clear picture of the sticker showing the barcode and the number.
        We use it to confirm the serial if the typed one doesn&apos;t match.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        capture="environment"
        className="sr-only"
        aria-label="Photo of the serial number label"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          // Reset so picking the same file twice still fires onChange.
          e.target.value = "";
        }}
      />

      {value && preview ? (
        <div className="mt-2 flex items-start gap-3 rounded-xl2 border border-line bg-white p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="The serial-number label photo you selected"
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-ink">{value.name}</p>
            <p className="mt-0.5 text-[12px] text-ink-subtle">
              {(value.size / (1024 * 1024)).toFixed(1)} MB
            </p>
            <div className="mt-1.5 flex gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-[12.5px] text-ink-muted underline underline-offset-2 hover:text-ink"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setLocalError(null);
                }}
                className="text-[12.5px] text-ink-muted underline underline-offset-2 hover:text-ink"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl2 border border-dashed px-4 py-5 text-[13px] transition ${
            shown
              ? "border-accent-danger/50 bg-accent-danger/[0.03] text-accent-danger"
              : "border-line bg-surface-raised text-ink-muted hover:border-ink/30 hover:text-ink"
          }`}
        >
          Take or upload a photo of the label
        </button>
      )}

      {shown && (
        <p role="alert" className="mt-1.5 text-[12.5px] text-accent-danger">
          {shown}
        </p>
      )}
    </div>
  );
}
