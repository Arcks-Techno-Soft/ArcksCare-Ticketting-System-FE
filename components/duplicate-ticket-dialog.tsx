"use client";

/**
 * DuplicateTicketDialog — why a submission was turned away on its serial number.
 *
 * The API dedups on `serial_number`: a device with an OPEN ticket raised inside
 * the dedup window can't raise a second one (see `find_recent_open_ticket`).
 * That 409 used to surface only as a card near the Submit button, at the foot of
 * a long form — customers filled everything in, pressed Submit, and read it as a
 * silent failure. It's a modal now so the reason is unmissable, and the inline
 * card stays behind it as the record once this is dismissed.
 */
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { fmtIst } from "@/lib/format-date";
import type { DuplicateError } from "@/lib/api";

type Props = {
  open: boolean;
  info: DuplicateError | null;
  /** The serial the customer typed — names the device the clash is about. */
  serialNumber?: string;
  onClose: () => void;
};

/** "about 5 hours" / "about an hour" / "shortly" — the wait before a re-raise. */
function waitPhrase(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "shortly";
  if (hours < 1) return "in under an hour";
  const rounded = Math.round(hours);
  return rounded === 1 ? "in about an hour" : `in about ${rounded} hours`;
}

export function DuplicateTicketDialog({
  open,
  info,
  serialNumber,
  onClose,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus the dismiss button so the dialog is reachable by keyboard and
  // screen readers announce it on open.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open || !info) return null;

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
          aria-labelledby="duplicate-ticket-title"
          aria-describedby="duplicate-ticket-message"
        >
          <div className="border-b border-line px-6 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-600">
              Not submitted
            </p>
            <h2
              id="duplicate-ticket-title"
              className="font-display text-2xl font-medium tracking-tight text-ink"
            >
              This device already has an open ticket
            </h2>
          </div>

          <div className="px-6 py-5">
            <p
              id="duplicate-ticket-message"
              className="text-[13.5px] leading-relaxed text-ink-muted"
            >
              {info.message}
            </p>

            <dl className="mt-4 space-y-2.5 rounded-xl2 border border-line bg-surface-raised px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[12.5px] text-ink-subtle">Existing ticket</dt>
                <dd className="font-mono text-[13.5px] font-medium text-ink">
                  {info.existing_reference}
                </dd>
              </div>
              {serialNumber?.trim() && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[12.5px] text-ink-subtle">Serial number</dt>
                  <dd className="font-mono text-[13.5px] text-ink">
                    {serialNumber.trim().toUpperCase()}
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[12.5px] text-ink-subtle">Current status</dt>
                <dd className="text-[13.5px] text-ink">
                  {info.existing_status.replace(/_/g, " ").toLowerCase()}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[12.5px] text-ink-subtle">Raised</dt>
                <dd className="text-[13.5px] text-ink">
                  {fmtIst(info.created_at)}
                </dd>
              </div>
            </dl>

            <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-subtle">
              Your details haven&apos;t been lost — nothing was submitted, so you
              can close this and change the serial number if you meant a
              different device. Otherwise you can raise a fresh ticket for this
              one {waitPhrase(info.hours_until_new_allowed)}.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            <Button
              ref={closeRef}
              type="button"
              variant="primary"
              onClick={onClose}
            >
              Got it
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
