"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FolderSearch, Package } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { HubTile } from "@/components/admin/hub-tile";
import { useAuth, isManagerLevel } from "@/lib/auth";

/** Quotations hub — Super Admin + Admin + Manager (the API is the real gate). */
export default function QuotationsHubPage() {
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (!isManagerLevel(user.role)) router.replace("/admin/tickets");
  }, [ready, user, router]);

  if (!ready || !user || !isManagerLevel(user.role)) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Quotations</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
            Quotations
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Build a quotation from the form, preview the exact PDF, and issue it.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <HubTile
            href="/admin/quotations/new"
            title="Create a new quotation"
            description="Fill the form, generate the PDF preview, then submit to issue it."
            icon={<FilePlus2 size={20} />}
          />
          <HubTile
            href="/admin/quotations/list"
            title="Explore existing quotations"
            description="Search issued quotations by reference or customer and open their PDFs."
            icon={<FolderSearch size={20} />}
          />
          <HubTile
            href="/admin/quotations/products"
            title="Product catalogue"
            description="Products with their spec text and photo, ready to drop into a quotation."
            icon={<Package size={20} />}
          />
        </div>
      </section>
    </AdminShell>
  );
}
