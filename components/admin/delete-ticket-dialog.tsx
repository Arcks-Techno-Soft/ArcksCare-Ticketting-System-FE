"use client";

/**
 * DeleteTicketDialog — Admin/Owner soft-delete confirmation.
 *
 * Deleting is destructive (the ticket disappears from every list), so the admin
 * must type the exact reference to enable the red Delete button. An optional
 * reason is recorded. Soft delete: the row is retained for audit/recovery.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { API_BASE_URL } from "@/lib/auth";

type Props = {
  open: boolean;
  reference: string;
  authFetch: typeof fetch;
  onClose: () => void;
  /** Called after a successful delete so the parent can refresh/navigate away. */
  onDeleted: () => void;
};

export function DeleteTicketDialog({ open, reference, authFetch, onClose, onDeleted }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmText("");
    setReason("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const matches = confirmText.trim().toUpperCase() === reference.toUpperCase();

  const handleDelete = async () => {
    if (!matches) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete ticket");
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
            <p className="text-[11px] uppercase tracking-[0.18em] text-red-600">Danger zone</p>
            <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
              Delete ticket {reference}
            </h2>
          </div>

          <div className="px-6 py-5">
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              This removes the ticket from every list, regardless of status. It&apos;s
              recoverable by support, but staff and customers will no longer see it.
            </p>

            <label htmlFor="del-confirm" className="mt-4 block text-[12.5px] font-medium text-ink">
              Type <span className="font-mono text-ink">{reference}</span> to confirm
            </label>
            <input
              id="del-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={reference}
              autoComplete="off"
              className="mt-1 w-full rounded-xl2 border border-line bg-white px-3.5 py-2.5 font-mono text-[14px] text-ink focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/15"
            />

            <label htmlFor="del-reason" className="mt-4 block text-[12.5px] font-medium text-ink">
              Reason <span className="text-ink-subtle">(optional)</span>
            </label>
            <textarea
              id="del-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this ticket being deleted?"
              className="mt-1 w-full rounded-xl2 border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />

            {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              variant="danger"
              loading={submitting}
              disabled={!matches}
              onClick={handleDelete}
            >
              Delete permanently
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
