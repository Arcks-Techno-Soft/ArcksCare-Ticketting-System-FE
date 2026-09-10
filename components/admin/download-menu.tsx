"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  downloadQuotationFile,
  FILE_FORMAT_LABELS,
  FILE_FORMATS,
  type FileFormat,
} from "@/lib/quotations-api";

/**
 * "Download ▾" menu for an issued quotation: PDF · Word (editable copy) ·
 * PNG · JPEG. Every format is fetched through the API with the staff JWT and
 * handed to the browser as a file; Word/PNG/JPEG are rendered on the server
 * on first request and cached.
 */
export function DownloadMenu({
  id,
  reference,
  compact = false,
  onError,
}: {
  id: number;
  reference: string;
  /** Smaller trigger for table rows. */
  compact?: boolean;
  onError?: (message: string) => void;
}) {
  const { authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<FileFormat | null>(null);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pick = async (format: FileFormat) => {
    setBusy(format);
    const err = await downloadQuotationFile(authFetch, id, reference, format);
    setBusy(null);
    setOpen(false);
    if (err) onError?.(err);
  };

  return (
    <div ref={root} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl2 font-medium tracking-tight transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2",
          compact
            ? "h-8 px-3 text-[13px] border border-line bg-white text-ink hover:border-ink hover:bg-surface-raised"
            : "h-10 w-full px-5 text-[14px] bg-ink text-white shadow-soft hover:bg-ink-soft hover:shadow-lift",
        )}
      >
        <Download size={compact ? 14 : 16} />
        {busy ? "Preparing…" : "Download"}
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="menu"
          className={cn(
            "absolute z-30 mt-1 min-w-[200px] overflow-hidden rounded-xl2 border border-line bg-white py-1 shadow-lift",
            compact ? "right-0" : "left-0 right-0",
          )}
        >
          {FILE_FORMATS.map((f) => (
            <li key={f} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={busy !== null}
                onClick={() => pick(f)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-surface-raised disabled:opacity-50"
              >
                <span>{FILE_FORMAT_LABELS[f]}</span>
                {busy === f && <span className="text-[12px] text-ink-subtle">…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
