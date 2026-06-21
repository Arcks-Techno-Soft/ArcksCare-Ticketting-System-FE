"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket, Wrench } from "lucide-react";

/**
 * Segmented toggle that switches the dashboard between the Tickets inbox and
 * the Installations list. Each tab is a real link so the two existing pages
 * keep their own data-fetching/filters; the active tab is derived from the URL.
 */
const TABS = [
  { label: "Tickets", href: "/admin/tickets", icon: Ticket, matchPrefix: "/admin/tickets" },
  {
    label: "Installations",
    href: "/admin/installations",
    icon: Wrench,
    // The /new form is its own page (reached from the sidebar), so it must not
    // light up the Installations dashboard tab.
    matchPrefix: "/admin/installations",
    excludePrefix: "/admin/installations/new",
  },
] as const;

export function DashboardViewTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-raised p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          pathname.startsWith(tab.matchPrefix) &&
          !("excludePrefix" in tab && tab.excludePrefix && pathname.startsWith(tab.excludePrefix));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-ink text-white shadow-soft"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={15} className={active ? "text-white" : "text-ink-subtle"} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
