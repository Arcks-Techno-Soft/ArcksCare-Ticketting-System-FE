"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Users, Wrench } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { HubTile } from "@/components/admin/hub-tile";
import { useAuth, isAdminLevel, isSuperAdmin } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (!isAdminLevel(user.role)) router.replace("/admin/tickets");
  }, [ready, user, router]);

  if (!ready || !user || !isAdminLevel(user.role)) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Settings</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
            Workspace settings
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Manage your team and account configuration.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* User management (create/roles/activation) is a RESERVED super-admin
              power — hide the tile from plain admins. */}
          {isSuperAdmin(user.role) && (
            <HubTile
              href="/admin/settings/users"
              title="Users & roles"
              description="Create new staff accounts, manage roles, deactivate access."
              icon={<Users size={20} />}
            />
          )}
          <HubTile
            href="/admin/settings/sub-engineers"
            title="Sub-engineer roster"
            description="Manage field contractors by district. Feeds each ticket's add dropdown."
            icon={<Wrench size={20} />}
          />
          <HubTile
            href="/admin/settings/spares"
            title="Spare parts & prices"
            description="Parts engineers pick while resolving, per product. Prices include GST."
            icon={<Package size={20} />}
          />
        </div>
      </section>
    </AdminShell>
  );
}
