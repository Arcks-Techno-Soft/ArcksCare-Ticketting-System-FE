"use client";

/**
 * TicketSummary - live, auto-populating "Review your ticket" card.
 *
 * Watches the parent react-hook-form via `values` and renders an organized
 * summary so the customer can review everything before hitting Submit.
 * Empty fields show as subtle "—" placeholders (no harsh empty labels).
 */
import { motion } from "framer-motion";
import type { TicketFormValues } from "@/lib/schema";

type Props = {
  values: Partial<TicketFormValues>;
  attachments?: File[];
};

const SEVERITY_DOT: Record<string, string> = {
  LOW: "bg-accent-success",
  MEDIUM: "bg-accent-warn",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-accent-danger",
};

export function TicketSummary({ values, attachments = [] }: Props) {
  const filledAny =
    Object.values(values).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== ""
    ) || attachments.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="grid gap-8 border-t border-line pt-10 md:grid-cols-[260px_1fr]"
    >
      <div>
        <div className="text-[12px] tracking-[0.18em] text-ink-subtle">06</div>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
          Review your ticket
        </h2>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-ink-muted">
          Have a quick look before submitting. Anything off? Scroll up and edit—this updates as you type.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl2 border border-line bg-white shadow-soft">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-raised px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-md bg-ink" />
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                New support ticket
              </div>
              <div className="font-display text-[15px] font-medium text-ink">
                ArcksCare
              </div>
            </div>
          </div>
          {values.severity ? (
            <SeverityBadge severity={values.severity} />
          ) : (
            <span className="text-[12px] text-ink-subtle">Severity not set</span>
          )}
        </div>

        {/* Body */}
        <div className="divide-y divide-line">
          <Block title="Customer">
            <Row label="Business" value={values.business_name} />
            <Row label="Type" value={values.business_type} />
            <Row label="Contact" value={values.contact_name} />
            <Row label="Phone" value={values.phone} />
            <Row label="Email" value={values.email} />
          </Block>

          <Block title="Address">
            <Row label="Line 1" value={values.address_line1} />
            <Row label="Line 2" value={values.address_line2} optional />
            <Row label="Line 3" value={values.address_line3} optional />
            <Row label="City" value={values.city} />
            <Row label="State" value={values.state} />
            <Row label="Pincode" value={values.pincode} />
            {typeof values.latitude === "number" && typeof values.longitude === "number" && (
              <Row
                label="Map pin"
                value={
                  <a
                    href={`https://www.google.com/maps?q=${values.latitude},${values.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {values.latitude.toFixed(5)}, {values.longitude.toFixed(5)} ↗
                  </a>
                }
              />
            )}
          </Block>

          <Block title="Product">
            <Row label="Category" value={values.product_category} />
            <Row
              label="Serial number"
              value={values.serial_number}
              mono
            />
          </Block>

          <Block title="Issue">
            <Row label="Category" value={values.issue_category} />
            <Row label="Severity" value={values.severity} />
            <Row
              label="Preferred time"
              value={values.preferred_contact_time}
              optional
            />
            <div className="px-6 py-3.5">
              <div className="text-[12px] uppercase tracking-[0.10em] text-ink-subtle">
                Description
              </div>
              <div className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                {values.description?.trim() || (
                  <span className="text-ink-subtle">— not yet written —</span>
                )}
              </div>
            </div>
          </Block>

          {attachments.length > 0 && (
            <Block title={`Attachments (${attachments.length})`}>
              <div className="px-4 py-2 space-y-1.5">
                {attachments.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[13.5px]">
                    <span className="truncate text-ink">{f.name}</span>
                    <span className="shrink-0 text-ink-subtle">{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>
            </Block>
          )}
        </div>

        {!filledAny && (
          <div className="border-t border-line bg-surface-raised px-6 py-3.5 text-center text-[12px] text-ink-subtle">
            Start filling the form above &mdash; your details will appear here.
          </div>
        )}
      </div>
    </motion.section>
  );
}

/* --------------------------- Internals ---------------------------------- */

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 py-2">
      <div className="px-4 pb-1 pt-3 text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
        {title}
      </div>
      <div className="divide-y divide-line/60">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  optional = false,
}: {
  label: string;
  value?: string | React.ReactNode;
  mono?: boolean;
  optional?: boolean;
}) {
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");

  if (isEmpty && optional) return null;

  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-3 px-4 py-2.5">
      <span className="text-[12.5px] text-ink-subtle">{label}</span>
      <span
        className={
          "text-[14px] " +
          (isEmpty ? "text-ink-subtle" : "text-ink ") +
          (mono ? "font-mono text-[13.5px]" : "")
        }
      >
        {isEmpty ? "—" : value}
      </span>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const dot = SEVERITY_DOT[severity] ?? "bg-ink";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {severity}
    </span>
  );
}
