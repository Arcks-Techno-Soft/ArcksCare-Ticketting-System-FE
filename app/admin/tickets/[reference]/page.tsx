"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { StatusBadge, SeverityBadge, WarrantyBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { EngineerPicker, type Engineer } from "@/components/admin/engineer-picker";
import { WorkNotes, type WorkNote } from "@/components/admin/work-notes";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { useRef } from "react";
import { Label } from "@/components/ui/Field";

/* ------------------------------ types ------------------------------------ */

type AdminTicket = {
  id: number;
  reference: string;
  business_name: string;
  contact_name: string;
  phone: string;
  email: string;
  business_type: string;
  address_line1: string;
  address_line2?: string | null;
  address_line3?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  product_category: string;
  serial_number: string;
  issue_category: string;
  severity: string;
  status: string;
  warranty_status: string;
  description?: string;
  created_at: string;
  attachments: { id: number; filename: string; storage_url: string; size_bytes: number; content_type: string }[];

  acknowledged_by?: Engineer | null;
  acknowledged_at?: string | null;
  assigned_by?: Engineer | null;
  assigned_engineer?: Engineer | null;
  assigned_at?: string | null;

  accepted_at?: string | null;
  resolving_started_at?: string | null;
  resolved_at?: string | null;
  resolution_summary?: string | null;

  resolution?: {
    id: number;
    customer_signer_name?: string | null;
    customer_signed_at?: string | null;
    engineer_signed_at?: string | null;
    pdf_generated_at?: string | null;
    customer_sign_token: string;
  } | null;
};

type TicketEvent = {
  id: number;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  payload?: Record<string, unknown> | null;
  note?: string | null;
  created_at: string;
  actor?: { id: number; username: string; name: string; role: string } | null;
};

const WARRANTY_OPTIONS = ["UNDER_WARRANTY", "OUT_OF_WARRANTY", "UNKNOWN"] as const;
const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const SEVERITY_DOTS: Record<string, string> = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-600",
};

/* ============================== component =============================== */

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams<{ reference: string }>();
  const reference = params?.reference?.toString() ?? "";
  const { ready, user, authFetch } = useAuth();

  const [ticket, setTicket] = useState<AdminTicket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [notes, setNotes] = useState<WorkNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [selectedEngineerId, setSelectedEngineerId] = useState<number | null>(null);
  const [resolveSummary, setResolveSummary] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);

  // Auth gate
  useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  const fetchAll = useCallback(async () => {
    if (!reference) return;
    try {
      const [t, e, eng, n] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}`),
        authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}/events`),
        authFetch(`${API_BASE_URL}/api/v1/admin/engineers`),
        authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}/notes`),
      ]);
      if (t.status === 404) {
        setTicket(null);
        setLoading(false);
        return;
      }
      if (!t.ok || !e.ok || !eng.ok || !n.ok) throw new Error("Failed to load ticket");
      setTicket(await t.json());
      setEvents(await e.json());
      setEngineers(await eng.json());
      setNotes(await n.json());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [reference, authFetch]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAll();
  }, [user, fetchAll]);

  /* --------------------------- actions -------------------------------- */

  const callAction = async (
    label: string,
    endpoint: string,
    method: "POST" | "PATCH" = "POST",
    body?: unknown
  ) => {
    setActionError(null);
    setActing(label);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}${endpoint}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try {
          const j = JSON.parse(t);
          msg = j.detail ?? msg;
        } catch {
          msg = t.slice(0, 200);
        }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  const handleAcknowledge = () => callAction("ack", "/acknowledge");
  const handleAssign = () => {
    if (!selectedEngineerId) {
      setActionError("Pick an engineer first.");
      return;
    }
    callAction("assign", "/assign", "POST", { engineer_id: selectedEngineerId });
    setSelectedEngineerId(null); // reset picker after successful submit
  };
  const handleWarranty = (next: string) =>
    callAction(`warranty-${next}`, "/warranty", "PATCH", { warranty_status: next });

  const handleSeverity = (next: string) =>
    callAction(`severity-${next}`, "/severity", "PATCH", { severity: next });

  const handleAccept = () => callAction("accept", "/accept");
  const handleStartWork = () => callAction("start", "/start-work");
  const handleResolve = async () => {
    if (resolveSummary.trim().length < 10) {
      setActionError("Resolution summary must be at least 10 characters.");
      return;
    }
    await callAction("resolve", "/resolve", "POST", { summary: resolveSummary.trim() });
    setResolveSummary("");
    setShowResolveForm(false);
  };

  const handleDownloadPdf = async () => {
    setActionError(null);
    setActing("pdf");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/pdf`
      );
      if (!res.ok) {
        const txt = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(txt).detail ?? msg; } catch { msg = txt.slice(0, 200); }
        throw new Error(msg);
      }
      const data = (await res.json()) as { url: string; filename: string };
      // Open in a new tab. Supabase signed URLs serve with appropriate headers
      // so the browser will display the PDF inline (or download if the file
      // has Content-Disposition: attachment, which we can configure later).
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setActing(null);
    }
  };

  const handleCustomerSign = async (signature: Blob, signerName: string) => {
    setActionError(null);
    setActing("customer-sign");
    try {
      const fd = new FormData();
      fd.append("signer_name", signerName.trim());
      fd.append("signature", signature, "customer-signature.png");
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/sign-customer`,
        { method: "POST", body: fd }
      );
      if (!res.ok) {
        const txt = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(txt).detail ?? msg; } catch { msg = txt.slice(0, 200); }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Customer signature failed");
    } finally {
      setActing(null);
    }
  };

  const handleEngineerSign = async (signature: Blob) => {
    setActionError(null);
    setActing("sign");
    try {
      const fd = new FormData();
      fd.append("signature", signature, "engineer-signature.png");
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/sign-engineer`,
        { method: "POST", body: fd }
      );
      if (!res.ok) {
        const txt = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(txt).detail ?? msg; } catch { msg = txt.slice(0, 200); }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Signing failed");
    } finally {
      setActing(null);
    }
  };

  const handleAddNote = async (body: string) => {
    setActionError(null);
    setActing("note");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try {
          msg = JSON.parse(t).detail ?? msg;
        } catch {
          msg = t.slice(0, 200);
        }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Note failed");
    } finally {
      setActing(null);
    }
  };

  /* --------------------------- render --------------------------------- */

  if (!ready || !user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <AdminNav />
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="h-8 w-64 animate-pulse rounded bg-surface-sunken" />
          <div className="mt-6 h-4 w-96 animate-pulse rounded bg-surface-sunken" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-white">
        <AdminNav />
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h1 className="font-display text-3xl text-ink">Ticket not found</h1>
          <p className="mt-2 text-ink-muted">No ticket with reference <code>{reference}</code>.</p>
          <Link href="/admin/tickets" className="mt-6 inline-block text-ink underline-offset-2 hover:underline">
            ← Back to tickets
          </Link>
        </div>
      </div>
    );
  }

  const canModerate = user.role === "OWNER" || user.role === "MANAGER";
  const isOwner = user.role === "OWNER";

  return (
    <div className="min-h-screen bg-white">
      <AdminNav />

      <section className="mx-auto max-w-7xl px-6 py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin/tickets"
            className="text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            ← All tickets
          </Link>
          <button
            type="button"
            onClick={fetchAll}
            className="text-[12.5px] text-ink-muted hover:text-ink transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Headline */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="font-mono text-[12.5px] text-ink-subtle">{ticket.reference}</p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tightest text-ink">
              {ticket.business_name}
            </h1>
            <p className="mt-1 text-[14.5px] text-ink-muted">
              {ticket.issue_category} on {ticket.product_category}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <SeverityBadge severity={ticket.severity} />
            <WarrantyBadge status={ticket.warranty_status} />
          </div>
        </div>

        {/* Body grid */}
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          {/* LEFT: ticket info */}
          <div className="space-y-10">
            <DetailBlock title="Customer">
              <Row label="Business" value={`${ticket.business_name} · ${ticket.business_type}`} />
              <Row label="Contact" value={ticket.contact_name} />
              <Row label="Phone" value={<a className="hover:underline" href={`tel:${ticket.phone}`}>{ticket.phone}</a>} />
              <Row label="Email" value={<a className="hover:underline" href={`mailto:${ticket.email}`}>{ticket.email}</a>} />
            </DetailBlock>

            <DetailBlock title="Address">
              <Row label="Line 1" value={ticket.address_line1} />
              {ticket.address_line2 && <Row label="Line 2" value={ticket.address_line2} />}
              {ticket.address_line3 && <Row label="Line 3" value={ticket.address_line3} />}
              <Row label="City" value={`${ticket.city}, ${ticket.state} — ${ticket.pincode}`} />
              {typeof ticket.latitude === "number" && typeof ticket.longitude === "number" && (
                <Row
                  label="Map pin"
                  value={
                    <a
                      className="hover:underline"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps?q=${ticket.latitude},${ticket.longitude}`}
                    >
                      {ticket.latitude.toFixed(5)}, {ticket.longitude.toFixed(5)} ↗
                    </a>
                  }
                />
              )}
            </DetailBlock>

            <DetailBlock title="Product">
              <Row label="Category" value={ticket.product_category} />
              <Row label="Serial number" value={<code className="font-mono text-[13.5px]">{ticket.serial_number}</code>} />
            </DetailBlock>

            <DetailBlock title="Issue">
              <Row label="Category" value={ticket.issue_category} />
              <Row label="Severity" value={ticket.severity} />
              {ticket.description && (
                <div className="px-4 py-3.5">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">Description</div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                    {ticket.description}
                  </p>
                </div>
              )}
            </DetailBlock>

            {ticket.attachments.length > 0 && (
              <DetailBlock title={`Attachments (${ticket.attachments.length})`}>
                <div className="px-2 py-2">
                  {ticket.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.storage_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-md px-2 py-2 text-[13.5px] hover:bg-surface-raised"
                    >
                      <span className="font-mono text-[10px] font-semibold uppercase rounded border border-line bg-surface-raised px-1.5 py-0.5">
                        {a.filename.split(".").pop()?.slice(0, 4) ?? "FILE"}
                      </span>
                      <span className="flex-1 truncate text-ink">{a.filename}</span>
                      <span className="text-[12px] text-ink-subtle">
                        {(a.size_bytes / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </a>
                  ))}
                </div>
              </DetailBlock>
            )}
          </div>

          {/* RIGHT: action panel + timeline */}
          <aside className="space-y-8">
            <ActionPanel
              ticket={ticket}
              engineers={engineers}
              currentUserId={user.id}
              currentUserRole={user.role}
              canModerate={canModerate}
              isOwner={isOwner}
              acting={acting}
              actionError={actionError}
              selectedEngineerId={selectedEngineerId}
              setSelectedEngineerId={setSelectedEngineerId}
              resolveSummary={resolveSummary}
              setResolveSummary={setResolveSummary}
              showResolveForm={showResolveForm}
              setShowResolveForm={setShowResolveForm}
              onAcknowledge={handleAcknowledge}
              onAssign={handleAssign}
              onWarranty={handleWarranty}
              onSeverity={handleSeverity}
              onAccept={handleAccept}
              onStartWork={handleStartWork}
              onResolve={handleResolve}
              onEngineerSign={handleEngineerSign}
              onCustomerSign={handleCustomerSign}
              onDownloadPdf={handleDownloadPdf}
            />
            <WorkNotes
              notes={notes}
              canAdd={
                user.role === "ENGINEER" &&
                ticket.assigned_engineer?.id === user.id &&
                ticket.status === "RESOLVING"
              }
              adding={acting === "note"}
              onSubmit={handleAddNote}
            />
            <Timeline events={events} />
          </aside>
        </div>
      </section>
    </div>
  );
}

/* ------------------------- subcomponents -------------------------------- */

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl2 border border-line bg-white shadow-soft">
      <div className="border-b border-line bg-surface-raised px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
        {title}
      </div>
      <div className="divide-y divide-line/60">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-baseline gap-3 px-4 py-2.5">
      <span className="text-[12.5px] text-ink-subtle">{label}</span>
      <span className="text-[14px] text-ink">{value}</span>
    </div>
  );
}

function ActionPanel(props: {
  ticket: AdminTicket;
  engineers: Engineer[];
  currentUserId: number;
  currentUserRole: string;
  canModerate: boolean;
  isOwner: boolean;
  acting: string | null;
  actionError: string | null;
  selectedEngineerId: number | null;
  setSelectedEngineerId: (s: number | null) => void;
  resolveSummary: string;
  setResolveSummary: (s: string) => void;
  showResolveForm: boolean;
  setShowResolveForm: (b: boolean) => void;
  onAcknowledge: () => void;
  onAssign: () => void;
  onWarranty: (next: string) => void;
  onSeverity: (next: string) => void;
  onAccept: () => void;
  onStartWork: () => void;
  onResolve: () => void;
  onEngineerSign: (blob: Blob) => Promise<void> | void;
  onCustomerSign: (blob: Blob, signerName: string) => Promise<void> | void;
  onDownloadPdf: () => void | Promise<void>;
}) {
  const {
    ticket, engineers, currentUserId, currentUserRole, canModerate, isOwner,
    acting, actionError, selectedEngineerId, setSelectedEngineerId,
    resolveSummary, setResolveSummary, showResolveForm, setShowResolveForm,
    onAcknowledge, onAssign, onWarranty, onSeverity,
    onAccept, onStartWork, onResolve, onEngineerSign, onCustomerSign, onDownloadPdf,
  } = props;
  const signPadRef = useRef<SignaturePadHandle>(null);
  const [signEmpty, setSignEmpty] = useState(true);

  // Customer signature capture (on engineer's device)
  const custPadRef = useRef<SignaturePadHandle>(null);
  const [custEmpty, setCustEmpty] = useState(true);
  const [custName, setCustName] = useState("");

  // Pre-fill the customer name field once the ticket loads
  useEffect(() => {
    if (!custName && ticket.contact_name) setCustName(ticket.contact_name);
  }, [ticket.contact_name, custName]);

  const submitCustomerSig = async () => {
    const blob = await custPadRef.current?.getBlob();
    if (!blob) return;
    await onCustomerSign(blob, custName.trim());
    custPadRef.current?.clear();
  };

  const submitEngineerSig = async () => {
    const blob = await signPadRef.current?.getBlob();
    if (!blob) return;
    await onEngineerSign(blob);
    signPadRef.current?.clear();
  };

  const canAcknowledge = canModerate && ticket.status === "OPEN";
  const canAssign = canModerate && ["ACKNOWLEDGED", "ASSIGNED", "ACCEPTED"].includes(ticket.status);

  // Engineer actions are only available to THE engineer assigned to this ticket.
  const isMyTicket =
    currentUserRole === "ENGINEER" && ticket.assigned_engineer?.id === currentUserId;
  const canAccept = isMyTicket && ticket.status === "ASSIGNED";
  const canStart = isMyTicket && ticket.status === "ACCEPTED";
  const canResolve = isMyTicket && ticket.status === "RESOLVING";

  // Signing state (Phase 2.4 — both signatures now collected in-app)
  const customerSigned = !!ticket.resolution?.customer_signed_at;
  const engineerSigned = !!ticket.resolution?.engineer_signed_at;
  // Engineer captures customer's signature on their device first…
  const canCaptureCustomer =
    isMyTicket && ticket.status === "RESOLVED" && !customerSigned;
  // …then signs themselves to close the ticket.
  const canEngineerSign =
    isMyTicket && ticket.status === "RESOLVED" && customerSigned && !engineerSigned;
  const canDownloadPdf =
    (isOwner || currentUserRole === "MANAGER") &&
    ticket.status === "CLOSED" &&
    !!ticket.resolution?.pdf_generated_at;

  const hasAnyAction =
    canAcknowledge || canAssign || isOwner || canAccept || canStart || canResolve ||
    canCaptureCustomer || canEngineerSign || canDownloadPdf ||
    (ticket.status === "RESOLVED" && !customerSigned);
  if (!hasAnyAction) {
    return (
      <div className="rounded-xl2 border border-line bg-surface-raised p-5 text-[13px] text-ink-muted">
        No actions available at status <strong>{ticket.status}</strong>.
        {currentUserRole === "ENGINEER" && !isMyTicket && (
          <> This ticket isn&apos;t assigned to you.</>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl2 border border-line bg-white p-5 shadow-soft">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">Actions</p>
        <h3 className="mt-1 font-display text-xl font-medium tracking-tight text-ink">
          What&apos;s next?
        </h3>
      </div>

      {canAcknowledge && (
        <div>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={acting === "ack"}
            onClick={onAcknowledge}
            className="w-full"
          >
            Acknowledge
          </Button>
          <p className="mt-2 text-[12px] text-ink-subtle">
            Marks the ticket as triaged. Next, assign it to an engineer.
          </p>
        </div>
      )}

      {canAssign && (
        <div>
          {ticket.assigned_engineer && (
            <div className="mb-3 rounded-md border border-line bg-surface-raised px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                Currently assigned
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-[10.5px] font-medium text-ink">
                  {ticket.assigned_engineer.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-[13.5px] font-medium text-ink">
                  {ticket.assigned_engineer.name}
                </span>
              </div>
            </div>
          )}
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink">
            {ticket.assigned_engineer ? "Reassign to another engineer" : "Assign to"}
          </label>
          <EngineerPicker
            engineers={engineers}
            selectedId={selectedEngineerId}
            onChange={setSelectedEngineerId}
            // When reassigning, hide the engineer currently on the ticket — reassigning
            // to the same person isn't a meaningful action.
            excludeId={ticket.assigned_engineer?.id ?? null}
            placeholder="Choose engineer"
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={acting === "assign"}
            onClick={onAssign}
            className="mt-3 w-full"
          >
            {ticket.assigned_engineer ? "Reassign engineer" : "Assign engineer"}
          </Button>
        </div>
      )}

      {/* ------------------- engineer actions ------------------- */}
      {canAccept && (
        <div>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={acting === "accept"}
            onClick={onAccept}
            className="w-full"
          >
            Accept ticket
          </Button>
          <p className="mt-2 text-[12px] text-ink-subtle">
            Confirms you&apos;ve seen this assignment. You can then start work.
          </p>
        </div>
      )}

      {canStart && (
        <div>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={acting === "start"}
            onClick={onStartWork}
            className="w-full"
          >
            Start working
          </Button>
          <p className="mt-2 text-[12px] text-ink-subtle">
            Moves the ticket to <strong>Resolving</strong>. Add work notes as you go.
          </p>
        </div>
      )}

      {canResolve && (
        <div>
          {!showResolveForm ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setShowResolveForm(true)}
              className="w-full"
            >
              Mark resolved
            </Button>
          ) : (
            <div className="space-y-3">
              <label className="block text-[12.5px] font-medium text-ink">
                Resolution summary
              </label>
              <Textarea
                placeholder="What was the fix? Any parts replaced, settings changed, customer guidance given?"
                value={resolveSummary}
                onChange={(e) => setResolveSummary(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setShowResolveForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  loading={acting === "resolve"}
                  onClick={onResolve}
                  className="flex-1"
                >
                  Confirm
                </Button>
              </div>
              <p className="text-[12px] text-ink-subtle">
                Customer will be asked to sign the resolution document in Phase 2.4.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ------------------- signing status -------------------- */}
      {ticket.status === "RESOLVED" && ticket.resolution && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">Signatures</p>
          <div className="mt-2 space-y-1.5 text-[13px]">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${customerSigned ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="text-ink">
                Customer: {customerSigned ? (
                  <>signed by <strong>{ticket.resolution.customer_signer_name}</strong></>
                ) : "awaiting signature"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${engineerSigned ? "bg-emerald-500" : "bg-neutral-300"}`} />
              <span className="text-ink">
                Engineer: {engineerSigned ? "signed" : "pending"}
              </span>
            </div>
          </div>
          {!customerSigned && !canCaptureCustomer && (
            <p className="mt-3 text-[12px] text-ink-subtle">
              The assigned engineer captures the customer&apos;s signature on-site.
            </p>
          )}
        </div>
      )}

      {/* ------------------- step 1: customer signature -------------------- */}
      {canCaptureCustomer && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
            Step 1 · Customer signature
          </p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Pass the device to the customer to capture their signature.
          </p>
          <div className="mt-3">
            <Label htmlFor="cust_name" required>Customer name</Label>
            <input
              id="cust_name"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              className="w-full rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] text-ink
                         transition-all hover:border-line-strong focus:border-ink focus:outline-none
                         focus:ring-2 focus:ring-ink/10"
              placeholder="Full name"
            />
          </div>
          <div className="mt-3">
            <SignaturePad ref={custPadRef} onChangeIsEmpty={setCustEmpty} height={160} />
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={custEmpty || custName.trim().length < 2}
            loading={acting === "customer-sign"}
            onClick={submitCustomerSig}
            className="mt-3 w-full"
          >
            Submit customer signature
          </Button>
        </div>
      )}

      {/* ------------------- step 2: engineer signature -------------------- */}
      {canEngineerSign && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
            Step 2 · Your countersignature
          </p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Signing will close the ticket and generate the resolution PDF.
          </p>
          <div className="mt-3">
            <SignaturePad ref={signPadRef} onChangeIsEmpty={setSignEmpty} height={160} />
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={signEmpty}
            loading={acting === "sign"}
            onClick={submitEngineerSig}
            className="mt-3 w-full"
          >
            Sign &amp; close ticket
          </Button>
        </div>
      )}

      {canDownloadPdf && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
            Resolution document
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={acting === "pdf"}
            onClick={onDownloadPdf}
            className="mt-3 w-full"
          >
            Open PDF
          </Button>
          <p className="mt-2 text-[12px] text-ink-subtle">
            Opens in a new tab. Use your browser&apos;s Save (⌘S) to keep a copy.
          </p>
        </div>
      )}

      {!canAcknowledge && !canAssign && !canAccept && !canStart && !canResolve &&
       !canCaptureCustomer && !canEngineerSign && !canDownloadPdf && ticket.status !== "RESOLVED" && (
        <p className="text-[13px] text-ink-muted">
          No actions available at status <strong>{ticket.status}</strong>.
        </p>
      )}

      {/* Severity — Owner + Manager */}
      {canModerate && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">Severity</p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Triage the urgency. Customer didn&apos;t set this.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SEVERITY_OPTIONS.map((s) => {
              const active = ticket.severity === s;
              const dot = SEVERITY_DOTS[s];
              return (
                <button
                  key={s}
                  type="button"
                  disabled={acting?.startsWith("severity")}
                  onClick={() => onSeverity(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink-soft"
                  } disabled:opacity-50`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : dot}`} />
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isOwner && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">Warranty</p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Only the Owner can change this.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WARRANTY_OPTIONS.map((w) => {
              const active = ticket.warranty_status === w;
              return (
                <button
                  key={w}
                  type="button"
                  disabled={acting?.startsWith("warranty")}
                  onClick={() => onWarranty(w)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink-soft"
                  } disabled:opacity-50`}
                >
                  {w === "UNDER_WARRANTY" ? "In warranty" : w === "OUT_OF_WARRANTY" ? "Out of warranty" : "Unknown"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-md border border-accent-danger/30 bg-white p-3 text-[12.5px] text-accent-danger"
          >
            {actionError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Timeline({ events }: { events: TicketEvent[] }) {
  return (
    <div className="rounded-xl2 border border-line bg-white shadow-soft">
      <div className="border-b border-line bg-surface-raised px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
        Activity
      </div>
      <ol className="divide-y divide-line/60">
        {events.length === 0 ? (
          <li className="px-5 py-4 text-[13px] text-ink-subtle">No activity yet.</li>
        ) : (
          events.map((e) => (
            <li key={e.id} className="px-5 py-3.5">
              <p className="text-[13px] text-ink">
                {labelForEvent(e)}
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-subtle">
                {timeFmt(e.created_at)}
                {e.actor && <> · by {e.actor.name} ({e.actor.role.toLowerCase()})</>}
              </p>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}

function labelForEvent(e: TicketEvent): string {
  switch (e.event_type) {
    case "ACKNOWLEDGED": return "Acknowledged";
    case "ASSIGNED":
      return `Assigned to ${(e.payload as { engineer_name?: string } | null)?.engineer_name ?? "engineer"}`;
    case "REASSIGNED":
      return `Reassigned to ${(e.payload as { engineer_name?: string } | null)?.engineer_name ?? "engineer"}`;
    case "WARRANTY_UPDATED":
      return `Warranty ${(e.payload as { from?: string; to?: string } | null)?.from} → ${(e.payload as { from?: string; to?: string } | null)?.to}`;
    case "ACCEPTED": return "Accepted by engineer";
    case "RESOLVING_STARTED": return "Started resolving";
    case "RESOLVED": return "Marked resolved";
    case "CLOSED": return "Closed";
    default: return e.event_type;
  }
}

function timeFmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
