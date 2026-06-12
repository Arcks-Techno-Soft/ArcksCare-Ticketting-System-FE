"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Wrench, ChevronRight } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (user.role !== "OWNER") router.replace("/admin/tickets");
  }, [ready, user, router]);

  if (!ready || !user || user.role !== "OWNER") return null;

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
          <SettingsTile
            href="/admin/settings/users"
            title="Users & roles"
            description="Create new staff accounts, manage roles, deactivate access."
            icon={<Users size={20} />}
          />
          <SettingsTile
            href="/admin/settings/sub-engineers"
            title="Sub-engineer roster"
            description="Manage field contractors by district. Feeds each ticket's add dropdown."
            icon={<Wrench size={20} />}
          />
        </div>
      </section>
    </AdminShell>
  );
}

function SettingsTile({
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
