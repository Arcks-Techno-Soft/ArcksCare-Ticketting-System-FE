"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Settings,
  BarChart3,
  LogOut,
  Wrench,
  PlusCircle,
  Menu,
  X,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ENGINEER: "Engineer",
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** If set, only users with one of these roles see this item. */
  roles?: string[];
  /** href prefixes that should mark this item active. */
  matchPrefix?: string;
  /** Optional per-role override of `label` (e.g. engineers see a different word). */
  labelByRole?: Record<string, string>;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/tickets", icon: LayoutDashboard, matchPrefix: "/admin/tickets" },
  {
    label: "New Ticket",
    href: "/admin/tickets/new",
    icon: PlusCircle,
    matchPrefix: "/admin/tickets/new",
  },
  {
    label: "New Installation",
    labelByRole: { ENGINEER: "Installations" },
    href: "/admin/installations",
    icon: Wrench,
    roles: ["ADMIN", "MANAGER", "ENGINEER"],
    matchPrefix: "/admin/installations",
  },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, roles: ["ADMIN"] },
  { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["ADMIN"], matchPrefix: "/admin/settings" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  // Desktop-only collapse of the rail to icons.
  const [collapsed, setCollapsed] = useState(false);
  // Mobile-only off-canvas drawer.
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  // Longest-prefix wins so /admin/tickets/new highlights "New Ticket" rather
  // than "Dashboard" (whose prefix /admin/tickets also matches).
  const activeHref = visibleItems
    .filter((item) => {
      const prefix = item.matchPrefix ?? item.href;
      return pathname === item.href || pathname.startsWith(prefix);
    })
    .sort(
      (a, b) => (b.matchPrefix ?? b.href).length - (a.matchPrefix ?? a.href).length
    )[0]?.href;

  // Label/brand text is hidden only when the desktop rail is collapsed; on
  // mobile the drawer is always full-width so labels stay visible.
  const labelHiddenClass = collapsed ? "lg:hidden" : "";

  return (
    <div className="flex min-h-screen bg-white">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar: off-canvas drawer on mobile, sticky rail on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-line bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-16" : "lg:w-60"}`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Link
            href="/admin/tickets"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <BrandMark className="h-7 w-7 shrink-0" />
            <div className={`flex items-baseline gap-2 overflow-hidden ${labelHiddenClass}`}>
              <span className="font-display text-[18px] font-semibold tracking-tight text-ink">
                SK-POS Support
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">
                Admin
              </span>
            </div>
          </Link>
          {/* Close (mobile only) */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center rounded-md p-1.5 text-ink-subtle hover:bg-surface-raised hover:text-ink lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === activeHref;
              const label = (user && item.labelByRole?.[user.role]) ?? item.label;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                      active
                        ? "bg-ink text-white"
                        : "text-ink-muted hover:bg-surface-raised hover:text-ink"
                    }`}
                    title={collapsed ? label : undefined}
                  >
                    <Icon
                      size={18}
                      className={`shrink-0 ${active ? "text-white" : "text-ink-subtle group-hover:text-ink"}`}
                    />
                    <span className={labelHiddenClass}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle (desktop only) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden items-center justify-center border-t border-line py-2 text-ink-subtle hover:bg-surface-raised hover:text-ink lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-end gap-3 border-b border-line bg-white px-4 sm:px-6">
          {/* Hamburger (mobile only) */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="mr-auto flex items-center justify-center rounded-md p-2 text-ink hover:bg-surface-raised lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          {user && (
            <>
              <div className="text-right leading-tight">
                <div className="text-[13.5px] text-ink">{user.name}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                  {ROLE_LABEL[user.role] ?? user.role}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          )}
        </header>

        {/* Page content */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
