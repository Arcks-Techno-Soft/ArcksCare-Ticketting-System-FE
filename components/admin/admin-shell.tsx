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
} from "lucide-react";

import { useAuth } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Admin",
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
    label: "New Installation",
    labelByRole: { ENGINEER: "Installations" },
    href: "/admin/installations",
    icon: Wrench,
    roles: ["OWNER", "MANAGER", "ENGINEER"],
    matchPrefix: "/admin/installations",
  },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, roles: ["OWNER"] },
  { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["OWNER"], matchPrefix: "/admin/settings" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside
        className={`sticky top-0 flex h-screen flex-col border-r border-line bg-white transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center border-b border-line px-4">
          <Link href="/admin/tickets" className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-7 w-7 shrink-0 rounded-md bg-ink" />
            {!collapsed && (
              <div className="flex items-baseline gap-2 overflow-hidden">
                <span className="font-display text-[18px] font-semibold tracking-tight text-ink">
                  SK-POS Support
                </span>
                <span className="text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">
                  Admin
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = item.matchPrefix
                ? pathname.startsWith(item.matchPrefix)
                : pathname === item.href;
              const label = (user && item.labelByRole?.[user.role]) ?? item.label;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                      active
                        ? "bg-ink text-white"
                        : "text-ink-muted hover:bg-surface-raised hover:text-ink"
                    }`}
                    title={collapsed ? label : undefined}
                  >
                    <Icon
                      size={18}
                      className={active ? "text-white" : "text-ink-subtle group-hover:text-ink"}
                    />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center border-t border-line py-2 text-ink-subtle hover:bg-surface-raised hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-end gap-3 border-b border-line bg-white px-6">
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
                Sign out
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
