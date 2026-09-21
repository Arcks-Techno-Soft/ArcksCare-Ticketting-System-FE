"use client";

/**
 * SerialNumberHelp — sample labels showing where the serial number is printed.
 *
 * Customers were raising tickets with invalid serials simply because they
 * couldn't find the number on the device. These sit under the serial field so
 * the answer is on screen while they're typing, rather than behind a link
 * nobody opens. Tapping one opens it full size — the thumbnails are legible
 * enough to locate the label, not to read the digits.
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type Sample = {
  src: string;
  /** Intrinsic size — next/image needs it for a local file. */
  width: number;
  height: number;
  label: string;
  alt: string;
};

const SAMPLES: Sample[] = [
  {
    src: "/serial-help/thermal-printer-label.png",
    width: 841,
    height: 513,
    label: "Thermal receipt printer",
    alt:
      "Label on an SK-POS thermal receipt printer. The serial number is on the " +
      "lower half, under the barcode: two letters followed by ten digits. " +
      "It is partly masked in this example.",
  },
  {
    src: "/serial-help/touch-pos-label.png",
    width: 593,
    height: 245,
    label: "Touch POS system",
    alt:
      "Label on an SK-POS Mighty Series touch POS system. The serial number is " +
      "on the right, under the barcode, and is all digits. It is partly masked " +
      "in this example.",
  },
];

export function SerialNumberHelp() {
  const [zoomed, setZoomed] = useState<Sample | null>(null);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoomed(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <div className="mt-3">
      <p className="text-[12.5px] leading-relaxed text-ink-subtle">
        Can&apos;t find it? The serial number is printed on a sticker on the
        device — usually underneath or on the back. Look for the number under
        the barcode, circled in red below. Enter it exactly as printed; the
        middle characters are hidden in these examples.
      </p>

      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SAMPLES.map((s) => (
          <figure key={s.src} className="min-w-0">
            <button
              type="button"
              onClick={() => setZoomed(s)}
              aria-label={`Enlarge the ${s.label} example label`}
              className="block w-full overflow-hidden rounded-xl2 border border-line bg-white transition hover:border-ink/30 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            >
              <Image
                src={s.src}
                width={s.width}
                height={s.height}
                alt={s.alt}
                className="h-auto w-full"
                sizes="(max-width: 640px) 100vw, 320px"
              />
            </button>
            <figcaption className="mt-1 text-[11.5px] text-ink-subtle">
              {s.label} · tap to enlarge
            </figcaption>
          </figure>
        ))}
      </div>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            key="zoom-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/60 px-4 py-10 backdrop-blur-sm"
            onClick={() => setZoomed(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${zoomed.label} — where to find the serial number`}
          >
            <motion.figure
              key="zoom-panel"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-line bg-white p-3 shadow-lift"
            >
              <Image
                src={zoomed.src}
                width={zoomed.width}
                height={zoomed.height}
                alt={zoomed.alt}
                className="h-auto w-full rounded-xl2"
                sizes="(max-width: 768px) 100vw, 672px"
              />
              <figcaption className="mt-2 flex items-center justify-between gap-3 px-1 pb-0.5">
                <span className="text-[12.5px] text-ink-muted">
                  {zoomed.label}
                </span>
                <button
                  type="button"
                  onClick={() => setZoomed(null)}
                  autoFocus
                  className="rounded-lg px-2.5 py-1 text-[12.5px] text-ink-subtle transition hover:bg-surface-raised hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                >
                  Close
                </button>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
