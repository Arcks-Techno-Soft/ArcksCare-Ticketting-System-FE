"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  ENGINEER: "Engineer",
};

export function AdminNav() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
  };

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/admin/tickets" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-ink" />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[20px] font-semibold tracking-tight text-ink">
              ArcksCare
            </span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              Admin
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-6 text-[13.5px]">
          <Link href="/admin/tickets" className="text-ink-muted hover:text-ink transition-colors">
            Tickets
          </Link>
          {user?.role === "OWNER" && (
            <Link href="/admin/team" className="text-ink-muted hover:text-ink transition-colors">
              Team
            </Link>
          )}
          {user && (
            <div className="flex items-center gap-3 pl-4 ml-2 border-l border-line">
              <div className="text-right leading-tight">
                <div className="text-[13.5px] text-ink">{user.name}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                  {ROLE_LABEL[user.role] ?? user.role}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
