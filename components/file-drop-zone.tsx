"use client";

/**
 * FileDropZone - drag-and-drop file picker with the premium white/black aesthetic.
 *
 * - Multi-file (up to MAX_FILES)
 * - Per-file size limit (MAX_FILE_BYTES)
 * - Validates extension + MIME type
 * - Shows selected files with icon + size + remove button
 * - Friendly inline error messages
 */
import { useCallback, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "video/mp4",
  "video/quicktime", // .mov
];
const ACCEPT_ATTR = ".jpg,.jpeg,.png,.gif,.mp4,.mov,image/jpeg,image/png,image/gif,video/mp4,video/quicktime";

export type SelectedFile = {
  file: File;
  id: string;
};

type Props = {
  files: SelectedFile[];
  onChange: (files: SelectedFile[]) => void;
};

export function FileDropZone({ files, onChange }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const acceptFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const newErrors: string[] = [];
      const accepted: SelectedFile[] = [];

      for (const f of list) {
        // Check type by MIME first, falling back to extension when the
        // browser doesn't set MIME (rare, but happens for .mov in some OSes).
        const ext = f.name.toLowerCase().split(".").pop() ?? "";
        const validMime = ACCEPTED_MIME.includes(f.type);
        const validExt = ["jpg", "jpeg", "png", "gif", "mp4", "mov"].includes(ext);
        if (!validMime && !validExt) {
          newErrors.push(`${f.name}: unsupported format`);
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          newErrors.push(`${f.name}: ${formatBytes(f.size)} (max 50 MB)`);
          continue;
        }
        accepted.push({ file: f, id: `${f.name}-${f.size}-${f.lastModified}` });
      }

      // Dedupe by id, respect MAX_FILES.
      const merged = [...files, ...accepted];
      const deduped: SelectedFile[] = [];
      const seen = new Set<string>();
      for (const sf of merged) {
        if (seen.has(sf.id)) continue;
        seen.add(sf.id);
        deduped.push(sf);
      }
      if (deduped.length > MAX_FILES) {
        newErrors.push(`Max ${MAX_FILES} files — only the first ${MAX_FILES} were kept.`);
      }
      const final = deduped.slice(0, MAX_FILES);
      onChange(final);
      setErrors(newErrors);
    },
    [files, onChange]
  );

  const handleBrowse = () => inputRef.current?.click();

  const removeAt = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <div>
      {/* Drop zone --------------------------------------------------- */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          acceptFiles(e.dataTransfer.files);
        }}
        onClick={handleBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleBrowse();
          }
        }}
        className={[
          "group relative cursor-pointer rounded-xl2 border-2 border-dashed bg-white",
          "px-6 py-10 text-center transition-colors duration-200",
          dragOver
            ? "border-ink bg-surface-raised"
            : "border-line-strong hover:border-ink hover:bg-surface-raised",
        ].join(" ")}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) acceptFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white shadow-soft group-hover:shadow-lift">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 16V4M12 4l-5 5M12 4l5 5" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <p className="text-[15px] text-ink">
          Drag &amp; drop files or <span className="underline underline-offset-2">click to browse</span>
        </p>
        <p className="mt-1.5 text-[12.5px] text-ink-subtle">
          JPG, PNG, GIF, MP4, MOV &middot; up to 50&nbsp;MB each &middot; max {MAX_FILES} files
        </p>
      </div>

      {/* Errors ------------------------------------------------------ */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 space-y-1 rounded-xl2 border border-accent-danger/30 bg-white p-3 text-[13px] text-accent-danger"
          >
            {errors.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Selected files list ---------------------------------------- */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-white shadow-soft"
          >
            {files.map((sf) => (
              <li key={sf.id} className="flex items-center gap-3 px-4 py-3">
                <FileIcon name={sf.file.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-ink">{sf.file.name}</div>
                  <div className="text-[12px] text-ink-subtle">{formatBytes(sf.file.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(sf.id)}
                  className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
                  aria-label={`Remove ${sf.file.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------- helpers ---------------------------------- */

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const isVideo = ext === "mp4" || ext === "mov";
  const label = isVideo ? "VID" : ext.toUpperCase().slice(0, 3);
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-raised font-mono text-[10px] font-semibold text-ink">
      {label}
    </div>
  );
}
