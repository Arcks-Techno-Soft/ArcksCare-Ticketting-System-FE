"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import {
  NoteAttachmentGrid,
  NoteImagePicker,
  type NoteAttachmentView,
  type PickedImage,
} from "@/components/admin/note-images";
import { fmtIst } from "@/lib/format-date";

export type AttemptNoteView = {
  id: number;
  body: string;
  created_at: string;
  author: { id: number; name: string; role: string };
  attachments?: NoteAttachmentView[];
};

export type AttemptView = {
  id: number;
  attempt_number: number;
  started_at: string;
  ended_at?: string | null;
  started_by?: { id: number; name: string; role: string } | null;
  notes: AttemptNoteView[];
};

/**
 * Work-attempts log shared by the ticket and installation detail pages.
 * Each attempt is one visit: start it, add notes + photos inside it, end it,
 * then the next attempt becomes available. All side-effects go through the
 * parent-supplied callbacks (which hit the API and refetch the detail).
 */
export function AttemptsBlock({
  attempts,
  canWork,
  canStart,
  onStart,
  onEnd,
  onAddNote,
}: {
  attempts: AttemptView[];
  /** Assignee / Manager / Admin may run attempts on a workable status. */
  canWork: boolean;
  /** Parent status allows starting a new attempt (no open one exists). */
  canStart: boolean;
  onStart: () => Promise<void>;
  onEnd: (attemptId: number) => Promise<void>;
  onAddNote: (body: string, files: File[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);

  const openAttempt = attempts.find((a) => !a.ended_at) ?? null;
  const nextNumber = attempts.reduce((m, a) => Math.max(m, a.attempt_number), 0) + 1;

  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const handleAddNote = () =>
    run("note", async () => {
      const body = draft.trim();
      if (body.length < 2 && images.length === 0) return;
      await onAddNote(body, images.map((p) => p.file));
      images.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setDraft("");
      setImages([]);
    });

  return (
    <div className="rounded-xl2 border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          Work attempts
        </span>
        <span className="text-[11px] text-ink-subtle">
          {attempts.length ? `${attempts.length} attempt${attempts.length === 1 ? "" : "s"}` : "Internal only"}
        </span>
      </div>

      <div className="space-y-4 p-5">
        {error && (
          <div className="rounded-md border border-accent-danger/30 bg-white p-3 text-[12.5px] text-accent-danger">
            {error}
          </div>
        )}

        {attempts.length === 0 && (
          <p className="text-[13px] text-ink-subtle">
            {canStart
              ? "No attempts yet. Start the first attempt to log work on-site."
              : "No attempts yet."}
          </p>
        )}

        {attempts.map((attempt) => {
          const isOpen = !attempt.ended_at;
          return (
            <div key={attempt.id} className="rounded-xl2 border border-line p-4">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-ink">
                  Attempt {attempt.attempt_number}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    isOpen
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  {isOpen ? "In progress" : "Done"}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-ink-subtle">
                {attempt.started_by ? `${attempt.started_by.name} · ` : ""}
                Started {fmtIst(attempt.started_at)}
                {attempt.ended_at ? ` · Ended ${fmtIst(attempt.ended_at)}` : ""}
              </p>

              <ol className="mt-3 space-y-3">
                {attempt.notes.length === 0 ? (
                  <li className="text-[12.5px] text-ink-subtle">No notes in this attempt yet.</li>
                ) : (
                  attempt.notes.map((note) => (
                    <li key={note.id} className="border-t border-line/60 pt-3 first:border-0 first:pt-0">
                      {note.body && (
                        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                          {note.body}
                        </p>
                      )}
                      {note.attachments && note.attachments.length > 0 && (
                        <NoteAttachmentGrid attachments={note.attachments} />
                      )}
                      <p className="mt-1 text-[11.5px] text-ink-subtle">
                        {note.author.name}
                        <span className="mx-1">·</span>
                        {fmtIst(note.created_at)}
                      </p>
                    </li>
                  ))
                )}
              </ol>

              {/* Composer + End — only inside the open attempt, for workers. */}
              {isOpen && canWork && (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  <Textarea
                    placeholder="Describe the work done in this attempt…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <NoteImagePicker images={images} onChange={setImages} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      disabled={draft.trim().length < 2 && images.length === 0}
                      loading={busy === "note"}
                      onClick={handleAddNote}
                    >
                      Add note
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      loading={busy === "end"}
                      onClick={() => run("end", () => onEnd(attempt.id))}
                    >
                      End attempt
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {canWork && canStart && !openAttempt && (
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={busy === "start"}
            onClick={() => run("start", onStart)}
          >
            Start attempt {nextNumber}
          </Button>
        )}
      </div>
    </div>
  );
}
