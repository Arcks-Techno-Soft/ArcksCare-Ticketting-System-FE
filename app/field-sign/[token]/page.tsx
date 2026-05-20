"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup } from "@/components/ui/Field";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { fmtIst } from "@/lib/format-date";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SubEngineer = {
  id: number;
  name: string;
  phone: string;
  location: string;
};

type FieldDoc = {
  reference: string;
  business_name: string;
  contact_name: string;
  address_line1: string;
  address_line2?: string | null;
  address_line3?: string | null;
  city: string;
  state: string;
  pincode: string;
  product_category: string;
  serial_number: string;
  issue_category: string;
  description?: string | null;
  resolution_summary?: string | null;
  engineer_name?: string | null;
  resolved_at?: string | null;
  customer_signed_at?: string | null;
  engineer_signed_at?: string | null;
  sub_engineers: SubEngineer[];
  completed: boolean;
};

export default function FieldSignPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token?.toString() ?? "";

  const [doc, setDoc] = useState<FieldDoc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subId, setSubId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [custEmpty, setCustEmpty] = useState(true);
  const [engEmpty, setEngEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const custPadRef = useRef<SignaturePadHandle>(null);
  const engPadRef = useRef<SignaturePadHandle>(null);

  const fetchDoc = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/sign/${token}/field`);
      if (res.status === 404) {
        setLoadError("This signing link wasn't found. It may have been removed.");
        return;
      }
      if (res.status === 410) {
        setLoadError("This signing link has expired. Please ask the engineer to issue a new one.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FieldDoc;
      setDoc(data);
      setCustomerName(data.contact_name);
      // Pre-fill the engineer — their details were already entered on the
      // ticket by the SK-POS Care engineer.
      setSubId(data.sub_engineers[0]?.id ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load resolution document");
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchDoc();
  }, [token, fetchDoc]);

  const handleSubmit = async () => {
    setSubmitError(null);
    if (subId == null) {
      setSubmitError("Select which sub-engineer you are.");
      return;
    }
    if (customerName.trim().length < 2) {
      setSubmitError("Enter the customer's name as it appears on their ID.");
      return;
    }
    const custBlob = await custPadRef.current?.getBlob();
    if (!custBlob || custEmpty) {
      setSubmitError("Capture the customer's signature before submitting.");
      return;
    }
    const engBlob = await engPadRef.current?.getBlob();
    if (!engBlob || engEmpty) {
      setSubmitError("Add your own signature before submitting.");
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.append("sub_engineer_id", String(subId));
    fd.append("customer_signer_name", customerName.trim());
    fd.append("customer_signature", custBlob, "customer-signature.png");
    fd.append("engineer_signature", engBlob, "subengineer-signature.png");
    try {
      const res = await fetch(`${API_BASE}/api/v1/sign/${token}/field`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const txt = await res.text();
        let msg = `${res.status}`;
        try {
          msg = JSON.parse(txt).detail ?? msg;
        } catch {
          msg = txt.slice(0, 200);
        }
        throw new Error(msg);
      }
      const updated = (await res.json()) as FieldDoc;
      setDoc(updated);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <Layout>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="font-display text-3xl text-ink">Link unavailable</h1>
          <p className="mt-3 text-ink-muted">{loadError}</p>
        </div>
      </Layout>
    );
  }

  if (!doc) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl py-16">
          <div className="h-7 w-64 animate-pulse rounded bg-surface-sunken" />
          <div className="mt-4 h-3 w-96 animate-pulse rounded bg-surface-sunken" />
          <div className="mt-10 h-64 animate-pulse rounded bg-surface-sunken" />
        </div>
      </Layout>
    );
  }

  // Already submitted — link is now spent.
  if (doc.completed) {
    return (
      <Layout>
        <div className="mx-auto max-w-md py-24 text-center animate-rise-in">
          <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-full border border-line">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12.5l4.5 4.5L20 6.5" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Resolution submitted</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tightest text-ink">
            Signatures recorded.
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-ink-muted">
            Both signatures for <strong>{doc.reference}</strong> were submitted on{" "}
            <strong>{fmtIst(doc.engineer_signed_at)}</strong>. The ticket is now closed
            and the resolution document is available to the SK-POS Care team.
            This link is no longer active.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
          Field resolution sign-off
        </p>
        <h1 className="mt-3 font-display text-5xl font-medium leading-[1.1] tracking-tightest text-ink md:text-6xl">
          Collect both signatures.
        </h1>
        <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-muted">
          Review the resolution below with the customer. Capture the customer&apos;s
          signature, then add your own to confirm the on-site work is complete.
          Submitting closes the ticket.
        </p>

        <div className="mt-10 overflow-hidden rounded-xl2 border border-line bg-white shadow-soft">
          <div className="border-b border-line bg-surface-raised px-6 py-3">
            <p className="font-mono text-[12.5px] text-ink-subtle">{doc.reference}</p>
            <p className="mt-0.5 font-display text-[18px] font-medium text-ink">
              {doc.business_name}
            </p>
          </div>
          <div className="divide-y divide-line/60">
            <Section title="Product">
              <Row k="Category" v={doc.product_category} />
              <Row k="Serial number" v={<code className="font-mono text-[13px]">{doc.serial_number}</code>} />
            </Section>

            <Section title="Issue reported">
              <Row k="Category" v={doc.issue_category} />
              {doc.description && (
                <div className="px-4 py-2.5">
                  <p className="text-[12px] uppercase tracking-[0.10em] text-ink-subtle">Original description</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                    {doc.description}
                  </p>
                </div>
              )}
            </Section>

            <Section title="Resolution by SK-POS Care">
              {doc.engineer_name && <Row k="Engineer" v={doc.engineer_name} />}
              {doc.resolved_at && <Row k="Resolved on" v={fmtIst(doc.resolved_at)} />}
              <div className="px-4 py-2.5">
                <p className="text-[12px] uppercase tracking-[0.10em] text-ink-subtle">Summary</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                  {doc.resolution_summary || "—"}
                </p>
              </div>
            </Section>
          </div>
        </div>

        {/* ---- Engineer info ---- */}
        <div className="mt-12 space-y-4">
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
            Engineer info
          </h2>
          {doc.sub_engineers.length === 0 ? (
            <p className="rounded-xl2 border border-accent-danger/30 bg-white p-3.5 text-[13px] text-accent-danger">
              No sub-engineers are listed on this ticket. Ask the SK-POS Care
              engineer to add you before signing.
            </p>
          ) : doc.sub_engineers.length === 1 ? (
            <>
              <p className="text-[13px] text-ink-muted">
                These details were entered for this ticket by the SK-POS Care engineer.
              </p>
              <div className="rounded-xl2 border border-line bg-surface-raised px-4 py-3">
                <p className="text-[14px] font-medium text-ink">
                  {doc.sub_engineers[0].name}
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-subtle">
                  {doc.sub_engineers[0].phone} · {doc.sub_engineers[0].location}
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] text-ink-muted">
                Confirm which engineer you are — details were entered for this
                ticket by the SK-POS Care engineer.
              </p>
              <div className="space-y-2">
                {doc.sub_engineers.map((s) => {
                  const selected = subId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubId(s.id)}
                      className={`flex w-full items-center gap-3 rounded-xl2 border px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-ink bg-surface-raised ring-2 ring-ink/10"
                          : "border-line bg-white hover:border-line-strong"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selected ? "border-ink" : "border-line-strong"
                        }`}
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-ink" />}
                      </span>
                      <span>
                        <span className="block text-[14px] font-medium text-ink">{s.name}</span>
                        <span className="block text-[12.5px] text-ink-subtle">
                          {s.phone} · {s.location}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ---- Customer signature ---- */}
        <div className="mt-12 space-y-6">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
              Customer signature
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Hand the device to the customer to confirm the device is fixed.
            </p>
          </div>

          <FieldGroup>
            <Label htmlFor="customer_name" required>Customer name</Label>
            <Input
              id="customer_name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Full name"
            />
          </FieldGroup>

          <SignaturePad ref={custPadRef} onChangeIsEmpty={setCustEmpty} height={160} />
        </div>

        {/* ---- Sub-engineer signature ---- */}
        <div className="mt-12 space-y-6">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
              Your signature
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Sign below to confirm you completed the on-site service.
            </p>
          </div>

          <SignaturePad ref={engPadRef} onChangeIsEmpty={setEngEmpty} height={160} />

          <AnimatePresence>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl2 border border-accent-danger/30 bg-white p-3.5 text-[13px] text-accent-danger"
              >
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={
                subId == null ||
                customerName.trim().length < 2 ||
                custEmpty ||
                engEmpty ||
                doc.sub_engineers.length === 0
              }
              loading={submitting}
              onClick={handleSubmit}
            >
              Submit resolution
            </Button>
          </div>

          <p className="text-[12px] text-ink-subtle">
            By submitting, both parties acknowledge the resolution above and that
            the device is working as expected. This closes the ticket.
          </p>
        </div>
      </section>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-ink" />
            <span className="font-display text-[22px] font-semibold tracking-tight text-ink">
              SK-POS Care
            </span>
          </Link>
        </div>
      </header>
      {children}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-2">
      <p className="px-4 pb-1 pt-3 text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
        {title}
      </p>
      <div className="divide-y divide-line/60">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-3 px-4 py-2.5">
      <span className="text-[12.5px] text-ink-subtle">{k}</span>
      <span className="text-[14px] text-ink">{v}</span>
    </div>
  );
}
