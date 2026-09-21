"use client";

/**
 * SerialNumberHelp — the sample label for the product the customer picked.
 *
 * Customers were raising tickets with invalid serials simply because they
 * couldn't find the number on the device. The sample sits under the serial
 * field so the answer is on screen while they're typing, rather than behind a
 * link nobody opens. Only the matching device is shown — a printer label is
 * noise on a POS ticket — and the generic hint carries the other categories,
 * which have no sample of their own.
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type Sample = {
  src: string;
  /** Intrinsic size — next/image needs it for a local file. */
  width: number;
  height: number;
  title: string;
  alt: string;
};

/** Keyed by the product_category values in lib/options.ts. */
export const SERIAL_SAMPLES: Record<string, Sample> = {
  Printer: {
    src: "/serial-help/thermal-printer-label.png",
    width: 841,
    height: 513,
    title: "Printer",
    alt:
      "Label on an SK-POS thermal receipt printer. The serial number is on the " +
      "lower half, under the barcode: two letters followed by ten digits. " +
      "It is partly masked in this example.",
  },
  "POS Machine": {
    src: "/serial-help/touch-pos-label.png",
    width: 593,
    height: 245,
    title: "POS machine",
    alt:
      "Label on an SK-POS Mighty Series touch POS system. The serial number is " +
      "on the right, under the barcode, and is all digits. It is partly masked " +
      "in this example.",
  },
};

/** Whether this product category has a sample label (and so needs a photo). */
export function hasSerialSample(category?: string | null): boolean {
  return !!category && category in SERIAL_SAMPLES;
}

export function SerialNumberHelp({ productCategory }: { productCategory?: string }) {
  const sample = productCategory ? SERIAL_SAMPLES[productCategory] : undefined;
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoomed(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed]);

  // Don't leave the dialog open over a sample that just got swapped out.
  useEffect(() => setZoomed(false), [productCategory]);

  return (
    <div className="mt-3">
      <p className="text-[12.5px] leading-relaxed text-ink-subtle">
        Can&apos;t find it? The serial number is printed on a sticker on the
        device — usually underneath or on the back. Look for the number under
        the barcode.
        {sample &&
          " Enter it exactly as printed; the last few characters are hidden in this example."}
      </p>

      {sample && (
        <figure className="mt-2.5 max-w-lg">
          <figcaption className="font-display text-xl font-medium tracking-tight text-ink">
            {sample.title}
          </figcaption>
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label={`Enlarge the ${sample.title} example label`}
            className="mt-1 block w-full overflow-hidden rounded-xl2 border border-line bg-white transition hover:border-ink/30 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          >
            <Image
              src={sample.src}
              width={sample.width}
              height={sample.height}
              alt={sample.alt}
              className="h-auto w-full"
              sizes="(max-width: 640px) 100vw, 512px"
            />
          </button>
          <p className="mt-1 text-[11.5px] text-ink-subtle">Tap to enlarge</p>
        </figure>
      )}

      <AnimatePresence>
        {zoomed && sample && (
          <motion.div
            key="zoom-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/60 px-4 py-10 backdrop-blur-sm"
            onClick={() => setZoomed(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${sample.title} — where to find the serial number`}
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
              <figcaption className="px-1 pb-2 font-display text-2xl font-medium tracking-tight text-ink">
                {sample.title}
              </figcaption>
              <Image
                src={sample.src}
                width={sample.width}
                height={sample.height}
                alt={sample.alt}
                className="h-auto w-full rounded-xl2"
                sizes="(max-width: 768px) 100vw, 672px"
              />
              <div className="mt-2 flex justify-end px-1 pb-0.5">
                <button
                  type="button"
                  onClick={() => setZoomed(false)}
                  autoFocus
                  className="rounded-lg px-2.5 py-1 text-[12.5px] text-ink-subtle transition hover:bg-surface-raised hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                >
                  Close
                </button>
              </div>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
