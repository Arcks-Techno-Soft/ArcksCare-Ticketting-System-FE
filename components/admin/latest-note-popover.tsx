"use client";

/**
 * LatestNotePopover — a compact "Note" trigger for dashboard rows that lazily
 * loads and shows the most recent work note for a ticket/installation, so a
 * manager can see *why* something is pending without opening it.
 *
 * - Lazy: fetches notes only when first hovered/clicked (no N+1 on list render).
 * - Cached per instance: reopening doesn't refetch.
 * - Rendered in a portal with fixed positioning so the table's overflow-x
 *   wrapper can't clip it. Closes on outside click, Escape, scroll or resize.
 * - One popover open at a time (others close via a window event).
 * - stopPropagation so clicking the trigger never navigates into the row.
 *
 * The notes endpoints return notes ordered oldest→newest, so the latest is the
 * last element. Author is shown regardless of role.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type LatestNote = {
  body: string;
  author: string;
  created_at: string;
  attachments: number;
};

const OPEN_EVENT = "latest-note-popover:open";
const POPOVER_W = 320;

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function LatestNotePopover({
  notesUrl,
  authFetch,
}: {
  notesUrl: string;
  authFetch: AuthFetch;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<LatestNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const res = await authFetch(notesUrl);
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const arr = (await res.json()) as Array<{
        body: string;
        created_at: string;
        author?: { name?: string } | null;
        attachments?: unknown[];
      }>;
      if (arr.length) {
        const last = arr[arr.length - 1];
        setNote({
          body: last.body,
          author: last.author?.name ?? "Unknown",
          created_at: last.created_at,
          attachments: last.attachments?.length ?? 0,
        });
      } else {
        setNote(null);
      }
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load note");
    } finally {
      setLoading(false);
    }
  }, [authFetch, notesUrl, loaded, loading]);

  const show = useCallback(() => {
    const el = triggerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const left = Math.max(12, Math.min(r.left, window.innerWidth - POPOVER_W - 12));
      setPos({ top: r.bottom + 6, left });
    }
    setOpen(true);
    void load();
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  }, [load, id]);

  // Close when another popover opens.
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [id]);

  // Dismiss on outside click / Escape / scroll / resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Latest work note"
        title="Latest work note"
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else show();
        }}
        onMouseEnter={() => show()}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[11.5px] text-ink-muted transition-colors hover:border-ink-soft hover:text-ink"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        Note
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: POPOVER_W }}
            className="z-[100] rounded-xl2 border border-line bg-white p-3.5 text-[13px] shadow-lift"
          >
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-ink-subtle">
              Latest work note
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-ink-muted">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-ink" />
                Loading…
              </div>
            ) : error ? (
              <div className="text-red-600">{error}</div>
            ) : note ? (
              <>
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-ink-muted">
                  <span className="font-medium text-ink">{note.author}</span>
                  <span>
                    {timeAgo(note.created_at)}
                    {note.attachments ? ` · 📎 ${note.attachments}` : ""}
                  </span>
                </div>
                <p className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap text-ink">
                  {note.body}
                </p>
              </>
            ) : (
              <div className="italic text-ink-subtle">No updates yet</div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
