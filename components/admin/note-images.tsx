"use client";

/**
 * Inline image picker + thumbnail grid for the work-notes composer.
 *
 * Designed to live inside the small notes card (not the standalone intake
 * form) — so it's compact: a single row "+ Add photos" button that opens
 * the system picker, then a row of square thumbnails with remove buttons.
 *
 * Image-only (JPEG/PNG/GIF/WebP/HEIC). Max 5 images, 10 MB each.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
const ACCEPT_ATTR =
  ".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif";

export type PickedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type Props = {
  images: PickedImage[];
  onChange: (next: PickedImage[]) => void;
};

export function NoteImagePicker({ images, onChange }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Free object URLs when previews leave the DOM. Without this the browser
  // pins blob memory until reload.
  useEffect(() => {
    return () => {
      images.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // intentionally only on unmount — parent owns the list across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const issues: string[] = [];
      const picked: PickedImage[] = [];
      for (const f of list) {
        const ext = (f.name.toLowerCase().split(".").pop() ?? "");
        const validMime = ACCEPTED_MIME.includes(f.type);
        const validExt = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext);
        if (!validMime && !validExt) {
          issues.push(`${f.name}: not an image`);
          continue;
        }
        if (f.size > MAX_BYTES) {
          issues.push(`${f.name}: over 10 MB`);
          continue;
        }
        picked.push({
          id: `${f.name}-${f.size}-${f.lastModified}`,
          file: f,
          previewUrl: URL.createObjectURL(f),
        });
      }
      const merged = [...images];
      const seen = new Set(merged.map((p) => p.id));
      for (const p of picked) {
        if (seen.has(p.id)) {
          URL.revokeObjectURL(p.previewUrl);
          continue;
        }
        seen.add(p.id);
        merged.push(p);
      }
      if (merged.length > MAX_FILES) {
        issues.push(`Max ${MAX_FILES} images.`);
      }
      onChange(merged.slice(0, MAX_FILES));
      setError(issues.length ? issues.join(" · ") : null);
    },
    [images, onChange]
  );

  const removeAt = (id: string) => {
    const target = images.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(images.filter((p) => p.id !== id));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 5h2l1-1.5h4L11 5h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <circle cx="8" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          {images.length === 0 ? "Add photos" : `Add more (${images.length}/${MAX_FILES})`}
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
          title="Take a photo with this device's camera"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="1.5" y="4" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8" cy="8.5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5.5 4l1-1.3h3l1 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          Take photo
        </button>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) accept(e.target.files);
            e.target.value = "";
          }}
        />
        {/*
         * Capture input: separate from the regular picker because some browsers
         * silently ignore `capture` when `multiple` is also set, and a few
         * older Android browsers refuse to take a photo unless `multiple` is
         * absent. One photo per shot is fine — the user can tap it again.
         */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) accept(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="text-[11.5px] text-ink-subtle">Optional · JPG/PNG · 10 MB max each</span>
      </div>

      {error && (
        <p className="mt-2 text-[12px] text-accent-danger">{error}</p>
      )}

      {images.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {images.map((p) => (
            <li
              key={p.id}
              className="group relative h-16 w-16 overflow-hidden rounded-md border border-line bg-surface-raised"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={p.file.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(p.id)}
                aria-label={`Remove ${p.file.name}`}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- display grid: render attachments under a note ------------ */

export type NoteAttachmentView = {
  id: number;
  filename: string;
  storage_url: string;
  content_type: string;
};

export function NoteAttachmentGrid({ attachments }: { attachments: NoteAttachmentView[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <ul className="mt-2.5 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <li key={a.id} className="h-16 w-16 overflow-hidden rounded-md border border-line bg-surface-raised">
          <a href={a.storage_url} target="_blank" rel="noreferrer" title={a.filename}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.storage_url}
              alt={a.filename}
              className="h-full w-full object-cover transition-transform hover:scale-105"
              loading="lazy"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
