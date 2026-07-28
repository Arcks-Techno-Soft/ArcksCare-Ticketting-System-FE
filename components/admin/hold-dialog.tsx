"use client";

/**
 * HoldDialog — Manager/Admin parks a ticket or installation, or resumes one.
 *
 * Shared by both detail pages since the flows are identical bar the endpoint.
 * Holding needs a reason (the inbox badge and the audit trail show it);
 * resuming takes an optional note. Neither touches the job's status or its
 * assignee — a resumed job carries on exactly where it stopped.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { API_BASE_URL } from "@/lib/auth";

export type HoldKind = "ticket" | "installation";

type Props = {
  open: boolean;
  mode: "hold" | "resume";
  kind: HoldKind;
  reference: string;
  authFetch: typeof fetch;
  /** Shown on the resume dialog so the manager sees why it was parked. */
  currentReason?: string | null;
  onClose: () => void;
  /** Called after a successful hold/resume so the parent can refresh. */
  onDone: () => void;
};

export function HoldDialog({
  open,
  mode,
  kind,
  reference,
  authFetch,
  currentReason,
  onClose,
  onDone,
}: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const noun = kind === "ticket" ? "ticket" : "installation";
  const holding = mode === "hold";
  // The backend enforces min-length 3 on the hold reason; mirror it so the
  // button explains itself instead of bouncing a 422 back.
  const ready = holding ? text.trim().length >= 3 : true;

  const submit = async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const path = kind === "ticket" ? "tickets" : "installations";
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/${path}/${reference}/${mode}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            holding ? { reason: text.trim() } : { note: text.trim() || null }
          ),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try {
          msg = JSON.parse(t).detail ?? msg;
        } catch {
          msg = t.slice(0, 200);
        }
        throw new Error(msg);
      }
      onDone();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Failed to ${mode} this ${noun}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-10 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-line bg-white shadow-lift"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-b border-line px-6 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-600">
              {holding ? "Put on hold" : "Resume"}
            </p>
            <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
              {holding ? "Hold" : "Resume"} {reference}
            </h2>
          </div>

          <div className="px-6 py-5">
            {holding ? (
              <p className="text-[13.5px] leading-relaxed text-ink-muted">
                This {noun} stops counting toward{" "}
                {kind === "ticket" ? "the engineer" : "the engineer"}&apos;s open
                jobs and pauses its SLA clock and reminders. Nobody can act on it
                until it&apos;s resumed. The assignee and current stage are kept,
                so resuming picks up exactly where this left off.
              </p>
            ) : (
              <>
                <p className="text-[13.5px] leading-relaxed text-ink-muted">
                  This {noun} goes back onto the assignee&apos;s open jobs and its
                  SLA clock starts again. The time it spent on hold stays
                  excluded from the SLA breach report.
                </p>
                {currentReason && (
                  <p className="mt-3 rounded-xl2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
                    <span className="font-medium">On hold because:</span>{" "}
                    {currentReason}
                  </p>
                )}
              </>
            )}

            <label
              htmlFor="hold-text"
              className="mt-4 block text-[12.5px] font-medium text-ink"
            >
              {holding ? (
                "Reason"
              ) : (
                <>
                  Note <span className="text-ink-subtle">(optional)</span>
                </>
              )}
            </label>
            <textarea
              id="hold-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
              placeholder={
                holding
                  ? "e.g. waiting on a spare part from the vendor"
                  : "e.g. spare part arrived"
              }
              className="mt-1 w-full rounded-xl2 border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            {holding && (
              <p className="mt-1.5 text-[12px] text-ink-subtle">
                Shown on the {noun} and recorded in its history.
              </p>
            )}

            {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={submitting}
              disabled={!ready}
              onClick={submit}
            >
              {holding ? "Put on hold" : "Resume"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
