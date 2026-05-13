"use client";

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  OPEN:         { dot: "bg-blue-500",     label: "Open" },
  ACKNOWLEDGED: { dot: "bg-cyan-500",     label: "Acknowledged" },
  ASSIGNED:     { dot: "bg-indigo-500",   label: "Assigned" },
  ACCEPTED:     { dot: "bg-violet-500",   label: "Accepted" },
  RESOLVING:    { dot: "bg-amber-500",    label: "Resolving" },
  RESOLVED:     { dot: "bg-emerald-500",  label: "Resolved" },
  CLOSED:       { dot: "bg-neutral-400",  label: "Closed" },
};

const SEVERITY_STYLES: Record<string, string> = {
  LOW:      "text-emerald-700 border-emerald-200 bg-emerald-50",
  MEDIUM:   "text-amber-700 border-amber-200 bg-amber-50",
  HIGH:     "text-orange-700 border-orange-200 bg-orange-50",
  CRITICAL: "text-red-700 border-red-200 bg-red-50",
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { dot: "bg-ink", label: status };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-[12px] font-medium text-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_STYLES[severity] ?? "text-ink border-line bg-white";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${cls}`}>
      {severity}
    </span>
  );
}

export function WarrantyBadge({ status }: { status: string }) {
  if (status === "UNDER_WARRANTY") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        In warranty
      </span>
    );
  }
  if (status === "OUT_OF_WARRANTY") {
    return (
      <span className="inline-flex items-center rounded-full border border-line bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-ink-muted">
        Out of warranty
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-ink-subtle">
      Warranty unknown
    </span>
  );
}
