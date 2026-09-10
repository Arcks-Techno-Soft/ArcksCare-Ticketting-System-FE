"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { QuotationForm } from "@/components/admin/quotation-form";
import { useAuth, isAdminLevel } from "@/lib/auth";

export default function NewQuotationPage() {
  return (
    // useSearchParams needs a Suspense boundary on a statically rendered page.
    <Suspense fallback={null}>
      <NewQuotationPageInner />
    </Suspense>
  );
}

function NewQuotationPageInner() {
  const router = useRouter();
  const { ready, user } = useAuth();
  const search = useSearchParams();
  const fromId = search.get("from");

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
          <Link href="/admin/quotations" className="text-[13px] text-ink-muted transition-colors hover:text-ink">
            ← Quotations
          </Link>
          <p className="mt-4 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Quotations</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
            {fromId ? "Duplicate quotation" : "Create a new quotation"}
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            {fromId
              ? "Pre-filled from an issued quotation. Adjust anything, generate, then submit — it gets a fresh reference."
              : "Fill in the details, generate the PDF to check it, then submit to issue it with the next reference number."}
          </p>
        </div>
        <div className="mt-8">
          <QuotationForm fromId={fromId} />
        </div>
      </section>
    </AdminShell>
  );
}
