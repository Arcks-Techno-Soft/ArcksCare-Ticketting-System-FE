"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Card-style link used by hub pages (Settings, Quotations). */
export function HubTile({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl2 border border-line bg-white p-5 transition-colors hover:border-ink hover:bg-surface-raised"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-ink">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-medium text-ink">{title}</div>
        <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
      </div>
      <ChevronRight size={18} className="mt-1 shrink-0 text-ink-subtle transition-colors group-hover:text-ink" />
    </Link>
  );
}
