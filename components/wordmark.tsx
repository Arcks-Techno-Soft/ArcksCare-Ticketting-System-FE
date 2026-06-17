/** SK-POS CARE wordmark — brand mark + stacked title and tagline, used in headers. */

import { BrandMark } from "@/components/brand-mark";

interface WordmarkProps {
  /** Optional small uppercase badge after the title, e.g. "Admin". */
  badge?: string;
}

export function Wordmark({ badge }: WordmarkProps) {
  return (
    <>
      <BrandMark />
      <span className="flex flex-col leading-tight">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[19px] sm:text-[22px] font-semibold tracking-tight text-ink">
            SK-POS CARE
          </span>
          {badge && (
            <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              {badge}
            </span>
          )}
        </span>
        <span className="text-[10.5px] sm:text-[12px] tracking-tight text-ink-muted">
          Premium Support for your Hardware
        </span>
      </span>
    </>
  );
}
