/**
 * Date formatting helpers — every timestamp shown to a user is in IST.
 *
 * Why a shared helper: scattering `toLocaleString` calls means each one shows
 * the BROWSER's local timezone, which is wrong for an India-operating team
 * with engineers occasionally hitting the app from elsewhere. These helpers
 * always render `Asia/Kolkata` with an "IST" suffix so the data is unambiguous
 * regardless of where the viewer is.
 *
 * The helpers accept a string (ISO 8601 from the API), a Date, or null/undefined
 * (returns "—" for missing values, matching the PDF convention).
 */

const IST_TZ = "Asia/Kolkata";

type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "19 May 2026, 09:25 IST" — full timestamp with date + minutes. */
export function fmtIst(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  const text = d.toLocaleString("en-IN", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // Intl emits a comma between date and time in en-IN; normalise that to
  // "19 May 2026, 09:25" and pin "IST" on the end so the timezone reads
  // explicitly. Different runtimes occasionally vary the separator.
  return `${text.replace(", ", ", ")} IST`;
}

/** "19 May 2026, 09:25:13 IST" — full timestamp with seconds. */
export function fmtIstWithSeconds(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  const text = d.toLocaleString("en-IN", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${text} IST`;
}

/** "19 May 2026" — date only, IST-converted. */
export function fmtIstDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "09:25 IST" — clock time only. */
export function fmtIstTime(input: DateInput, opts?: { withSeconds?: boolean }): string {
  const d = toDate(input);
  if (!d) return "—";
  const text = d.toLocaleTimeString("en-IN", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    ...(opts?.withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  });
  return `${text} IST`;
}

/** "19 May" — short date label for chart axes etc. (IST-converted) */
export function fmtIstDateShort(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    day: "numeric",
    month: "short",
  });
}
