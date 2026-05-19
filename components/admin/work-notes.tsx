"use client";

/**
 * WorkNotes — internal engineer notes section on the ticket detail page.
 *
 * Read-only for everyone EXCEPT the assigned engineer while the ticket is
 * RESOLVING. Adds an inline composer (with optional worksite image upload)
 * when allowed; otherwise just renders the notes timeline.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  NoteAttachmentGrid,
  NoteImagePicker,
  type NoteAttachmentView,
  type PickedImage,
} from "@/components/admin/note-images";
import { fmtIst } from "@/lib/format-date";

export type WorkNote = {
  id: number;
  body: string;
  created_at: string;
  author: { id: number; name: string; role: string; username: string };
  attachments?: NoteAttachmentView[];
};

type Props = {
  notes: WorkNote[];
  canAdd: boolean;
  adding: boolean;
  /** Submit a note. `images` may be empty. */
  onSubmit: (body: string, images: File[]) => void | Promise<void>;
};

export function WorkNotes({ notes, canAdd, adding, onSubmit }: Props) {
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);

  const handleSubmit = async () => {
    const body = draft.trim();
    if (body.length < 2) return;
    await onSubmit(body, images.map((p) => p.file));
    setDraft("");
    // Revoke previews + clear once the parent has accepted them.
    images.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setImages([]);
  };

  return (
    <div className="rounded-xl2 border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          Work notes
        </span>
        <span className="text-[11px] text-ink-subtle">Internal only</span>
      </div>

      <ol className="divide-y divide-line/60">
        {notes.length === 0 ? (
          <li className="px-5 py-4 text-[13px] text-ink-subtle">
            No notes yet.
            {canAdd ? " Start by describing what you're seeing." : null}
          </li>
        ) : (
          notes.map((n) => (
            <li key={n.id} className="px-5 py-3.5">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                {n.body}
              </p>
              {n.attachments && n.attachments.length > 0 && (
                <NoteAttachmentGrid attachments={n.attachments} />
              )}
              <p className="mt-1 text-[11.5px] text-ink-subtle">
                {n.author.name}
                <span className="mx-1">·</span>
                {fmtIst(n.created_at)}
              </p>
            </li>
          ))
        )}
      </ol>

      <AnimatePresence>
        {canAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-line"
          >
            <div className="space-y-3 p-5">
              <Textarea
                placeholder="What did you find / try / fix?"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[90px]"
              />
              <NoteImagePicker images={images} onChange={setImages} />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={draft.trim().length < 2}
                  loading={adding}
                  onClick={handleSubmit}
                >
                  Save note
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
