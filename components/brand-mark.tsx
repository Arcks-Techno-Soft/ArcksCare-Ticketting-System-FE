/** Square SK-POS brand mark — used alongside the wordmark in headers. */

import Image from "next/image";

interface BrandMarkProps {
  /** Tailwind size classes, e.g. "h-7 w-7" (default) or "h-10 w-10". */
  className?: string;
}

export function BrandMark({ className = "h-7 w-7" }: BrandMarkProps) {
  return (
    <Image
      src="/sk-mark.png"
      alt=""
      width={64}
      height={64}
      priority
      className={`${className} rounded-md`.trim()}
    />
  );
}
