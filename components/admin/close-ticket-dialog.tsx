"use client";

/**
 * CloseTicketDialog — Admin/Owner force-close confirmation.
 *
 * On open it fetches GET /admin/tickets/{ref}/close-preview, shows a summary of
 * the ticket (status, assignment, workflow timestamps) plus a "what's still
 * pending" checklist, and requires a reason before the (red) Close button is
 * enabled. The parent passes authFetch so the call carries the staff JWT.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { API_BASE_URL } from "@/lib/auth";
import { fmtIst } from "@/lib/format-date";

type Engineer = { id: number; name: string };

type ClosePreview = {
  reference: string;
  business_name: string;
  status: string;
  warranty_status: string;
  service_type: string;
  assigned_engineer?: Engineer | null;
  additional_engineers?: { id: number; engineer: Engineer }[];
  acknowledged_at?: string | null;
  assigned_at?: string | null;
  accepted_at?: string | null;
  resolving_started_at?: string | null;
  resolved_at?: string | null;
  pending: string[];
};

type Props = {
  open: boolean;
  reference: string;
  authFetch: typeof fetch;
  onClose: () => void;
  /** Called after a successful force-close so the parent can refresh/navigate. */
  onClosed: () => void;
};

export function CloseTicketDialog({ open, reference, authFetch, onClose, onClosed }: Props) {
  const [preview, setPreview] = useState<ClosePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setReason("");
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/v1/admin/tickets/${reference}/close-preview`
        );
        if (!res.ok) throw new Error(`${res.status}`);
        setPreview((await res.json()) as ClosePreview);
      } catch {
        setError("Couldn't load the ticket summary. Try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, reference, authFetch]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleConfirm = async () => {
    if (reason.trim().length < 3) {
      setError("Please enter a reason for closing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/force-close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      onClosed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close ticket");
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
          className="w-full max-w-xl rounded-2xl border border-line bg-white shadow-lift"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
                Review before closing
              </p>
              <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
                Close ticket {reference}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {loading && <p className="text-[14px] text-ink-muted">Loading summary…</p>}

            {preview && (
              <>
                {/* Summary */}
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13.5px]">
                  <SummaryRow label="Business" value={preview.business_name} />
                  <SummaryRow label="Current status" value={preview.status} />
                  <SummaryRow label="Warranty" value={preview.warranty_status} />
                  <SummaryRow label="Service" value={preview.service_type} />
                  <SummaryRow
                    label="Assigned to"
                    value={preview.assigned_engineer?.name ?? "—"}
                  />
                  <SummaryRow
                    label="Co-engineers"
                    value={
                      preview.additional_engineers?.length
                        ? preview.additional_engineers.map((a) => a.engineer.name).join(", ")
                        : "—"
                    }
                  />
                  <SummaryRow label="Acknowledged" value={dt(preview.acknowledged_at)} />
                  <SummaryRow label="Assigned" value={dt(preview.assigned_at)} />
                  <SummaryRow label="Accepted" value={dt(preview.accepted_at)} />
                  <SummaryRow label="Resolved" value={dt(preview.resolved_at)} />
                </dl>

                {/* Pending */}
                <div className="mt-5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
                    Still pending ({preview.pending.length})
                  </p>
                  {preview.pending.length === 0 ? (
                    <p className="mt-1.5 text-[13.5px] text-emerald-700">
                      Nothing outstanding — this ticket is complete.
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3">
                      {preview.pending.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-amber-800">
                          <span aria-hidden>⚠</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Reason */}
                <div className="mt-5">
                  <label htmlFor="close-reason" className="mb-1 block text-[12.5px] font-medium text-ink">
                    Reason for closing <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="close-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this ticket being closed in its current state?"
                    className="w-full rounded-xl2 border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                  />
                </div>
              </>
            )}

            {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              variant="danger"
              loading={submitting}
              disabled={loading || !preview || reason.trim().length < 3}
              onClick={handleConfirm}
            >
              Close ticket
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function dt(iso?: string | null): string {
  return iso ? fmtIst(iso) : "—";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-subtle">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
