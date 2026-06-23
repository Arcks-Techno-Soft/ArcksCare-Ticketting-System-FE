"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Field";
import { EngineerPicker, type Engineer } from "@/components/admin/engineer-picker";
import { BUSINESS_TYPES, INDIAN_STATES } from "@/lib/options";
import type { LocationPayload } from "@/components/address-map";

// Leaflet touches `window`, so the map must be client-only.
const AddressMap = dynamic(() => import("@/components/address-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] w-full animate-pulse rounded-xl2 border border-line bg-surface-raised" />
  ),
});

type FormState = {
  business_name: string;
  business_category: string;
  contact_name: string;
  phone: string;
  email: string;
  invoice_number: string;
  products_for_installation: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  state: string;
  pincode: string;
};

const EMPTY: FormState = {
  business_name: "",
  business_category: "",
  contact_name: "",
  phone: "",
  email: "",
  invoice_number: "",
  products_for_installation: "",
  address_line1: "",
  address_line2: "",
  address_line3: "",
  city: "",
  state: "",
  pincode: "",
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
  const [geo, setGeo] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("later");
  const [assignMode, setAssignMode] = useState<AssignMode>("later");
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState<number | null>(null);
  const [salesReps, setSalesReps] = useState<{ id: number; name: string; username: string }[]>([]);
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<number | null>(null);
  const [invoiceDoc, setInvoiceDoc] = useState<File | null>(null);
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

  // Sales reps for the "sourced by" picker — only Admin/Manager pick one.
  useEffect(() => {
    if (!canAssign) return;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/admin/sales-reps`);
        if (res.ok) setSalesReps(await res.json());
      } catch {
        // optional — sales rep can be added later
      }
    })();
  }, [canAssign, authFetch]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Pin drop / search result on the map → fill geo + any address parts it returns.
  const onLocationChange = (loc: LocationPayload) => {
    setGeo({ lat: loc.lat, lng: loc.lng });
    const a = loc.address;
    setForm((f) => {
      const next = { ...f };
      if (a.line1) next.address_line1 = a.line1;
      if (a.line2) next.address_line2 = a.line2;
      if (a.line3) next.address_line3 = a.line3;
      if (a.city) next.city = a.city;
      if (a.pincode) next.pincode = a.pincode;
      if (a.state) {
        const match = INDIAN_STATES.find(
          (s) => s.toLowerCase() === a.state!.toLowerCase()
        );
        if (match) next.state = match;
      }
      return next;
    });
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
    if (form.products_for_installation.trim().length < 2)
      return setError("List the products to be installed.");
    if (form.address_line1.trim().length < 3) return setError("Address line 1 is required.");
    if (form.city.trim().length < 2) return setError("City is required.");
    if (!form.state) return setError("Select a state.");
    if (form.pincode.replace(/\D/g, "").length < 4) return setError("Enter a valid pincode.");

    const invoiceValue =
      invoiceMode === "later" ? INVOICE_DEFERRED : form.invoice_number.trim();

    const payload: Record<string, unknown> = {
      business_name: form.business_name.trim(),
      business_category: form.business_category,
      contact_name: form.contact_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      invoice_number: invoiceValue,
      products_for_installation: form.products_for_installation.trim(),
      address_line1: form.address_line1.trim(),
      address_line2: form.address_line2.trim() || null,
      address_line3: form.address_line3.trim() || null,
      city: form.city.trim(),
      state: form.state,
      pincode: form.pincode.trim(),
      latitude: geo.lat,
      longitude: geo.lng,
    };

    if (assignMode === "engineer") {
      if (!selectedEngineerId) return setError("Pick an engineer or change the assignment option.");
      payload.assigned_engineer_id = selectedEngineerId;
    } else if (assignMode === "self") {
      payload.assigned_engineer_id = user!.id;
    }

    // Optional sales rep credited with sourcing this installation.
    if (canAssign && selectedSalesRepId) {
      payload.sales_rep_id = selectedSalesRepId;
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

      // Optional invoice document. The installation already exists, so a
      // failed upload must not block navigation — surface it and let the user
      // retry from the installation page (re-submitting would duplicate it).
      if (invoiceDoc) {
        try {
          const fd = new FormData();
          fd.append("file", invoiceDoc, invoiceDoc.name);
          const up = await authFetch(
            `${API_BASE_URL}/api/v1/admin/installations/${created.reference}/invoice-document`,
            { method: "POST", body: fd }
          );
          if (!up.ok) {
            const t = await up.text();
            let msg = `Server ${up.status}`;
            try {
              msg = JSON.parse(t).detail ?? msg;
            } catch {
              msg = t.slice(0, 200);
            }
            throw new Error(msg);
          }
        } catch (e) {
          alert(
            `Installation ${created.reference} was created, but the invoice document didn't upload: ` +
              `${e instanceof Error ? e.message : "upload failed"}. You can add it from the installation page.`
          );
        }
      }

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

          <div>
            <Label htmlFor="products" required>Products for installation</Label>
            <Textarea
              id="products"
              rows={4}
              value={form.products_for_installation}
              onChange={(e) => update("products_for_installation", e.target.value)}
              placeholder={"POS Machine x 2\nThermal Printer x 1\nCash Drawer x 1"}
            />
            <p className="mt-1 text-[12px] text-ink-subtle">
              One product per line — name and quantity.
            </p>
          </div>

          <div>
            <Label htmlFor="invoice_doc">Invoice document (optional)</Label>
            <input
              id="invoice_doc"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setInvoiceDoc(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-[13.5px] text-ink-muted file:mr-3 file:rounded-full file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-[12.5px] file:font-medium file:text-ink hover:file:border-ink-soft"
            />
            {invoiceDoc && (
              <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-muted">
                <span className="truncate">{invoiceDoc.name}</span>
                <button
                  type="button"
                  onClick={() => setInvoiceDoc(null)}
                  className="text-ink underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              </p>
            )}
            <p className="mt-1 text-[12px] text-ink-subtle">PDF or image. You can also add this later.</p>
          </div>

          {/* Site address / location */}
          <div className="space-y-5 rounded-xl2 border border-line bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              Site address
            </p>

            <div>
              <Label htmlFor="address_line1" required>Address line 1</Label>
              <Input
                id="address_line1"
                value={form.address_line1}
                onChange={(e) => update("address_line1", e.target.value)}
                placeholder="Building name, floor, street"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="address_line2">Address line 2 (optional)</Label>
                <Input
                  id="address_line2"
                  value={form.address_line2}
                  onChange={(e) => update("address_line2", e.target.value)}
                  placeholder="Area, locality"
                />
              </div>
              <div>
                <Label htmlFor="address_line3">Address line 3 (optional)</Label>
                <Input
                  id="address_line3"
                  value={form.address_line3}
                  onChange={(e) => update("address_line3", e.target.value)}
                  placeholder="Landmark, additional info"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <Label htmlFor="city" required>City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Bengaluru"
                />
              </div>
              <div>
                <Label htmlFor="state" required>State</Label>
                <Select
                  id="state"
                  options={INDIAN_STATES}
                  placeholder="Select state"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pincode" required>Pincode</Label>
                <Input
                  id="pincode"
                  value={form.pincode}
                  onChange={(e) => update("pincode", e.target.value)}
                  placeholder="560001"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div>
              <Label
                hint={
                  geo.lat != null && geo.lng != null
                    ? `Pin set: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`
                    : "Optional"
                }
              >
                Drop a pin on the map
              </Label>
              <AddressMap onLocationChange={onLocationChange} />
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

          {/* Sales representative — owners/managers credit who sourced the deal */}
          {canAssign && (
          <div className="rounded-xl2 border border-line bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              Sales representative
            </p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Optional — credit the sales rep who sourced this installation.
            </p>
            <div className="mt-3">
              <Label htmlFor="sales_rep">Sales rep</Label>
              <select
                id="sales_rep"
                value={selectedSalesRepId ?? ""}
                onChange={(e) =>
                  setSelectedSalesRepId(e.target.value ? Number(e.target.value) : null)
                }
                className="mt-1 block w-full rounded-xl2 border border-line bg-white px-4 py-3 text-[14px] text-ink transition-all duration-200 hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
              >
                <option value="">None</option>
                {salesReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (@{r.username})
                  </option>
                ))}
              </select>
              {salesReps.length === 0 && (
                <p className="mt-1.5 text-[12px] text-ink-subtle">
                  No sales reps yet — add one under Settings · Users.
                </p>
              )}
            </div>
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
