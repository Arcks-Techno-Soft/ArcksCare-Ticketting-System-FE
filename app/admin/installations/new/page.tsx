"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { EngineerPicker, type Engineer } from "@/components/admin/engineer-picker";
import { BUSINESS_TYPES } from "@/lib/options";

type FormState = {
  business_name: string;
  business_category: string;
  contact_name: string;
  phone: string;
  email: string;
  invoice_number: string;
};

const EMPTY: FormState = {
  business_name: "",
  business_category: "",
  contact_name: "",
  phone: "",
  email: "",
  invoice_number: "",
};

type AssignMode = "later" | "engineer" | "self";
type InvoiceMode = "later" | "enter";

// Stored as the invoice number when the user defers entering one. The backend
// requires a non-empty string, so this sentinel keeps the field valid.
const INVOICE_DEFERRED = "To be added later";

export default function NewInstallationPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("later");
  const [assignMode, setAssignMode] = useState<AssignMode>("later");
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/admin/login");
    }
  }, [ready, user, router]);

  // Engineers can open installations but not pre-assign them — their
  // installation lands in the admin queue tagged "Opened by <name>".
  const canAssign = user?.role === "ADMIN" || user?.role === "MANAGER";

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/admin/engineers`);
        if (res.ok) setEngineers(await res.json());
      } catch {
        // optional — assignment can still happen later
      }
    })();
  }, [user, authFetch]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.business_name.trim().length < 2) return setError("Business name is required.");
    if (!form.business_category) return setError("Pick a category.");
    if (form.contact_name.trim().length < 2) return setError("Contact name is required.");
    if (form.phone.trim().length < 7) return setError("Phone number is required.");
    if (invoiceMode === "enter" && !form.invoice_number.trim())
      return setError("Enter the invoice number, or choose “To be added later”.");

    const invoiceValue =
      invoiceMode === "later" ? INVOICE_DEFERRED : form.invoice_number.trim();

    const payload: Record<string, unknown> = {
      business_name: form.business_name.trim(),
      business_category: form.business_category,
      contact_name: form.contact_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      invoice_number: invoiceValue,
    };

    if (assignMode === "engineer") {
      if (!selectedEngineerId) return setError("Pick an engineer or change the assignment option.");
      payload.assigned_engineer_id = selectedEngineerId;
    } else if (assignMode === "self") {
      payload.assigned_engineer_id = user!.id;
    }

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/installations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Server ${res.status}`;
        try {
          const j = JSON.parse(text);
          msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
        } catch {
          msg = text.slice(0, 200);
        }
        throw new Error(msg);
      }
      const created = (await res.json()) as { reference: string };
      router.push(`/admin/installations/${created.reference}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || !user) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/installations"
            className="text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            ← All installations
          </Link>
        </div>

        <h1 className="mt-4 font-display text-4xl font-medium tracking-tightest text-ink">
          Start new installation
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Capture just the basics. Work notes, signatures and PDF come next.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <Label htmlFor="biz" required>Business name</Label>
            <Input
              id="biz"
              value={form.business_name}
              onChange={(e) => update("business_name", e.target.value)}
              placeholder="e.g. Spice Garden"
            />
          </div>

          <div>
            <Label htmlFor="cat" required>Category</Label>
            <Select
              id="cat"
              options={BUSINESS_TYPES}
              placeholder="Select category"
              value={form.business_category}
              onChange={(e) => update("business_category", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="contact" required>Contact person</Label>
              <Input
                id="contact"
                value={form.contact_name}
                onChange={(e) => update("contact_name", e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label htmlFor="phone" required>Phone number</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+91 98xxxxxxxx"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="name@business.com"
                type="email"
              />
            </div>
            <div>
              <Label htmlFor="invoice" required>Invoice number</Label>
              <Select
                id="invoice"
                options={[INVOICE_DEFERRED, "Enter invoice number"]}
                placeholder="Select…"
                value={invoiceMode === "later" ? INVOICE_DEFERRED : "Enter invoice number"}
                onChange={(e) => {
                  const enter = e.target.value === "Enter invoice number";
                  setInvoiceMode(enter ? "enter" : "later");
                  if (!enter) update("invoice_number", "");
                }}
              />
              {invoiceMode === "enter" && (
                <Input
                  id="invoice_value"
                  className="mt-2"
                  value={form.invoice_number}
                  onChange={(e) => update("invoice_number", e.target.value)}
                  placeholder="INV-12345"
                  aria-label="Invoice number"
                />
              )}
            </div>
          </div>

          {/* Assignment — owners/managers only; engineer installs go to the queue */}
          {canAssign && (
          <div className="rounded-xl2 border border-line bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              Assignment
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { id: "later", label: "Assign later" },
                  { id: "self", label: "Assign to me" },
                  { id: "engineer", label: "Pick an engineer" },
                ] as { id: AssignMode; label: string }[]
              ).map((opt) => {
                const active = assignMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAssignMode(opt.id)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                      active
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-white text-ink hover:border-ink-soft"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {assignMode === "engineer" && (
              <div className="mt-4">
                <Label>Engineer</Label>
                <EngineerPicker
                  engineers={engineers}
                  selectedId={selectedEngineerId}
                  onChange={setSelectedEngineerId}
                  placeholder="Choose engineer"
                />
              </div>
            )}
          </div>
          )}

          <FieldError message={error ?? undefined} />

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin/installations">
              <Button type="button" variant="outline" size="md">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              Create installation
            </Button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
