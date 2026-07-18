"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth, API_BASE_URL, isAdminLevel, isSuperAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge, SeverityBadge, WarrantyBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { EngineerPicker, type Engineer } from "@/components/admin/engineer-picker";
import { AttemptsBlock, type AttemptView } from "@/components/admin/attempts-block";
import {
  AdditionalEngineers,
  type AdditionalEngineer,
} from "@/components/admin/additional-engineers";
import {
  SubEngineers,
  type SubEngineer,
  type RosterContact,
  type AddSubEngineerInput,
} from "@/components/admin/sub-engineers";
import {
  Spares,
  type ChargesSummary,
  type SpareCatalogItem,
} from "@/components/admin/spares";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { useRef } from "react";
import { Label } from "@/components/ui/Field";
import { ShipPartsDialog } from "@/components/admin/ship-parts-dialog";
import { CloseTicketDialog } from "@/components/admin/close-ticket-dialog";
import { DeleteTicketDialog } from "@/components/admin/delete-ticket-dialog";
import { fmtIst, fmtIstDate } from "@/lib/format-date";

/* ------------------------------ types ------------------------------------ */

type AdminTicket = {
  id: number;
  reference: string;
  business_name: string;
  contact_name: string;
  contact_person_profile?: string | null;
  phone: string;
  email: string | null;
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
  service_type: string;
  // Third-party support details (only for THIRD_PARTY_SUPPORT tickets).
  third_party_device_name?: string | null;
  third_party_issue_info?: string | null;
  third_party_ticket_ref?: string | null;
  // Payment tracking. payment_status null = legacy ticket (never gated).
  // payment_required is the backend-computed gate (OOW, or covered + charges).
  payment_status?: "PENDING" | "COLLECTED" | null;
  payment_required?: boolean;
  payment_amount_inr?: number | null;
  payment_collected_at?: string | null;
  payment_collected_by?: Engineer | null;
  // Partial-payment money breakdown. Ticket closes only when pending hits ₹0.
  amount_due_inr?: number;
  amount_collected_inr?: number;
  amount_pending_inr?: number;
  description?: string;
  created_at: string;
  attachments: { id: number; filename: string; storage_url: string; size_bytes: number; content_type: string }[];

  raised_by?: Engineer | null;
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
    engineer_signer_name?: string | null;
    pdf_generated_at?: string | null;
    field_sign_link_generated_at?: string | null;
    customer_sign_token: string;
    media?: {
      id: number;
      kind: "photo" | "video";
      filename: string;
      content_type: string;
      size_bytes: number;
      storage_url: string;
      uploaded_at: string;
    }[];
  } | null;

  sub_engineers?: SubEngineer[];
  additional_engineers?: AdditionalEngineer[];
  attempts?: AttemptView[];
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

type ShipmentItem = {
  id: number;
  catalog_id: number | null;
  name: string;
  quantity: number;
};

type Shipment = {
  id: number;
  courier_name: string;
  tracking_id: string | null;
  departed_at: string;
  delivered_at?: string | null;
  created_at: string;
  created_by?: { id: number; name: string; role: string } | null;
  items: ShipmentItem[];
};

// Selectable warranty statuses. UNKNOWN is intentionally excluded — it is the
// blank intake default and warranty must be set (under / out / AMC) before a
// ticket can be assigned to an engineer.
const WARRANTY_OPTIONS = ["UNDER_WARRANTY", "OUT_OF_WARRANTY", "AMC"] as const;
const SERVICE_TYPE_OPTIONS = [
  { value: "SITE_VISIT", label: "Site visit" },
  { value: "REMOTE_SUPPORT", label: "Remote support" },
  { value: "THIRD_PARTY_SUPPORT", label: "Third-party support" },
] as const;
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
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [selectedEngineerId, setSelectedEngineerId] = useState<number | null>(null);
  const [resolveSummary, setResolveSummary] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [coEngError, setCoEngError] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterContact[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [charges, setCharges] = useState<ChargesSummary | null>(null);
  const [spareCatalog, setSpareCatalog] = useState<SpareCatalogItem[]>([]);
  const [spareError, setSpareError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  // True only when the backend explicitly answered 404 for this reference.
  // Distinct from "ticket is null because a transient fetch failed", which
  // used to surface as a misleading "Ticket not found" screen.
  const [notFound, setNotFound] = useState(false);
  // True when the backend returned 403 — typically an engineer trying to open
  // a ticket they aren't assigned to (e.g. tapped a WhatsApp alert meant for
  // an owner/manager).
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  const fetchAll = useCallback(async () => {
    if (!reference) return;
    try {
      const [t, e, eng, s, c, sh] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}`),
        authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}/events`),
        authFetch(`${API_BASE_URL}/api/v1/admin/engineers?include_sales_reps=true`),
        authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}/sub-engineer-suggestions`),
        authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}/charges`),
        authFetch(`${API_BASE_URL}/api/v1/admin/tickets/${reference}/shipments`),
      ]);
      // 404 = ticket genuinely doesn't exist; show the "not found" screen.
      if (t.status === 404) {
        setNotFound(true);
        setForbidden(false);
        setTicket(null);
        setLoadError(null);
        setLoading(false);
        return;
      }
      // 403 = role-gated. Engineers see only their own tickets; if they tap
      // a notification link for someone else's ticket, show a clear
      // "access restricted" screen instead of a generic load error.
      if (t.status === 403) {
        setForbidden(true);
        setNotFound(false);
        setTicket(null);
        setLoadError(null);
        setLoading(false);
        return;
      }
      if (!t.ok) {
        // Any other status on the primary fetch is a real load error, not a
        // missing ticket. Surface the server message so users can retry or
        // ping ops, rather than misleading them with "Ticket not found".
        const body = await t.text();
        let msg = `Server ${t.status}`;
        try {
          const j = JSON.parse(body);
          if (typeof j.detail === "string") msg = j.detail;
        } catch {
          if (body) msg += `: ${body.slice(0, 200)}`;
        }
        throw new Error(msg);
      }
      // Secondary fetches: log failures but still render what we have.
      // (Old code conflated these with a missing ticket too.)
      setNotFound(false);
      setForbidden(false);
      setLoadError(null);
      setTicket(await t.json());
      setEvents(e.ok ? await e.json() : []);
      setEngineers(eng.ok ? await eng.json() : []);
      setRoster(s.ok ? ((await s.json()) as RosterContact[]) : []);
      setCharges(c.ok ? ((await c.json()) as ChargesSummary) : null);
      setShipments(sh.ok ? ((await sh.json()) as Shipment[]) : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
      setRosterLoading(false);
    }
  }, [reference, authFetch]);

  // Load the spare-parts catalog for the ticket's product category. Re-runs
  // only when the category changes — cheap and avoids repeat fetches on every
  // refresh.
  useEffect(() => {
    const product = ticket?.product_category;
    if (!product) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/v1/admin/spare-catalog?product=${encodeURIComponent(product)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as SpareCatalogItem[];
        if (!cancelled) setSpareCatalog(data);
      } catch {
        // Catalog is optional — silent failure is fine.
      }
    })();
    return () => { cancelled = true; };
  }, [ticket?.product_category, authFetch]);

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

  const handleSelfAssign = () => callAction("self-assign", "/self-assign");

  const handleAddSubEngineer = async (input: AddSubEngineerInput) => {
    setSubError(null);
    setActing("sub-add");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/sub-engineers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setSubError(e instanceof Error ? e.message : "Failed to add sub-engineer");
    } finally {
      setActing(null);
    }
  };

  const handleRemoveSubEngineer = async (id: number) => {
    setSubError(null);
    setActing("sub-remove");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/sub-engineers/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setSubError(e instanceof Error ? e.message : "Failed to remove sub-engineer");
    } finally {
      setActing(null);
    }
  };

  const handleSetSubEngineerFee = async (id: number, fee: number) => {
    setSubError(null);
    setActing("sub-fee");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/sub-engineers/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fee_inr: fee }),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setSubError(e instanceof Error ? e.message : "Failed to save fee");
    } finally {
      setActing(null);
    }
  };
  const handleAddCoEngineer = async (engineerId: number) => {
    setCoEngError(null);
    setActing("co-eng-add");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/engineers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ engineer_id: engineerId }),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setCoEngError(e instanceof Error ? e.message : "Failed to add engineer");
    } finally {
      setActing(null);
    }
  };

  const handleRemoveCoEngineer = async (engineerId: number) => {
    setCoEngError(null);
    setActing("co-eng-remove");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/engineers/${engineerId}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setCoEngError(e instanceof Error ? e.message : "Failed to remove engineer");
    } finally {
      setActing(null);
    }
  };

  const refreshCharges = useCallback(async () => {
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/charges`
      );
      if (res.ok) setCharges((await res.json()) as ChargesSummary);
    } catch {
      // ignore — next full refresh will recover
    }
  }, [authFetch, reference]);

  const handleSpareAdd = async (input: {
    catalog_id?: number;
    name?: string;
    unit_price_inr?: number;
    quantity: number;
  }) => {
    setSpareError(null);
    setActing("spare-add");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/spares`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      await refreshCharges();
    } catch (e) {
      setSpareError(e instanceof Error ? e.message : "Failed to add spare");
    } finally {
      setActing(null);
    }
  };

  // Persist all pending in-place charge edits in one shot: the service fee (if
  // changed) then each changed spare line, followed by a single charges refresh.
  // Called only when the user presses Submit in the Spares card — nothing auto-
  // saves. On any failure we stop and surface the error; the card keeps the
  // drafts so the user can retry.
  const handleSubmitCharges = async (changes: {
    serviceFeeInr?: number;
    spares: { id: number; unit_price_inr?: number; quantity?: number }[];
  }) => {
    const readErr = async (res: Response) => {
      const t = await res.text();
      try { return JSON.parse(t).detail ?? `${res.status}`; } catch { return t.slice(0, 200) || `${res.status}`; }
    };
    setSpareError(null);
    setActing("charges-submit");
    try {
      if (changes.serviceFeeInr !== undefined) {
        const res = await authFetch(
          `${API_BASE_URL}/api/v1/admin/tickets/${reference}/service-fee`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service_fee_inr: changes.serviceFeeInr }),
          }
        );
        if (!res.ok) throw new Error(await readErr(res));
      }
      for (const s of changes.spares) {
        const res = await authFetch(
          `${API_BASE_URL}/api/v1/admin/tickets/${reference}/spares/${s.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: s.quantity, unit_price_inr: s.unit_price_inr }),
          }
        );
        if (!res.ok) throw new Error(await readErr(res));
      }
      await refreshCharges();
    } catch (e) {
      setSpareError(e instanceof Error ? e.message : "Failed to save charges");
    } finally {
      setActing(null);
    }
  };

  const handleSpareRemove = async (id: number) => {
    setSpareError(null);
    setActing("spare-remove");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/spares/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
        throw new Error(msg);
      }
      await refreshCharges();
    } catch (e) {
      setSpareError(e instanceof Error ? e.message : "Failed to remove spare");
    } finally {
      setActing(null);
    }
  };

  const handleWarranty = (next: string) =>
    callAction(`warranty-${next}`, "/warranty", "PATCH", { warranty_status: next });

  const handleCollectPayment = (amount: number) =>
    callAction("collect-payment", "/collect-payment", "POST", {
      amount_collected_inr: amount,
    });

  const handleServiceType = (next: string) =>
    callAction(`service-type-${next}`, "/service-type", "PATCH", { service_type: next });

  const handleThirdPartyInfo = (payload: {
    third_party_device_name: string;
    third_party_issue_info: string;
    third_party_ticket_ref: string;
  }) => callAction("third-party-info", "/third-party-info", "PATCH", payload);

  const handleSeverity = (next: string) =>
    callAction(`severity-${next}`, "/severity", "PATCH", { severity: next });

  const handleAccept = () => callAction("accept", "/accept");
  const handleStartWork = () => callAction("start", "/start-work");
  const handleResolve = async (serviceFeeInr: number) => {
    if (resolveSummary.trim().length < 10) {
      setActionError("Resolution summary must be at least 10 characters.");
      return;
    }
    // Reject a below-minimum charge instead of silently accepting it — only a
    // Super Admin may go below the floor.
    const minFee = charges?.service_fee_min_inr ?? 0;
    if (!isSuper && serviceFeeInr < minFee) {
      setActionError(
        `Service charge can't be below ₹${minFee.toLocaleString("en-IN")} for this ticket. Only a Super Admin can set a lower amount.`
      );
      return;
    }
    // Persist the confirmed service charge first (only if it changed at the
    // confirm step) so the resolution + PDF reflect exactly what was confirmed.
    if (charges && serviceFeeInr !== charges.service_fee_inr) {
      setActionError(null);
      setActing("resolve");
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/v1/admin/tickets/${reference}/service-fee`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service_fee_inr: serviceFeeInr }),
          }
        );
        if (!res.ok) {
          const t = await res.text();
          let msg = `${res.status}`;
          try { msg = JSON.parse(t).detail ?? msg; } catch { msg = t.slice(0, 200); }
          setActionError(msg);
          setActing(null);
          return; // don't resolve if the charge couldn't be saved
        }
        setCharges((await res.json()) as ChargesSummary);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Failed to update service charge");
        setActing(null);
        return;
      }
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

  const handleRegenPdf = async () => {
    // Re-render the PDF in place after a template change. The file on storage
    // is a snapshot from close-time and won't reflect layout updates until we
    // explicitly re-render — that's what this endpoint does.
    setActionError(null);
    setActing("pdf-regen");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/pdf/regenerate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const txt = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(txt).detail ?? msg; } catch { msg = txt.slice(0, 200); }
        throw new Error(msg);
      }
      const data = (await res.json()) as { url: string };
      // Open the freshly-rendered file so the user immediately sees the new
      // layout. Cache-bust query in case the browser tab already had the
      // previous render open.
      window.open(`${data.url}#t=${Date.now()}`, "_blank", "noopener,noreferrer");
      await fetchAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "PDF regenerate failed");
    } finally {
      setActing(null);
    }
  };

  const handleShipParts = async (input: {
    courier_name: string;
    tracking_id: string | null;
    departed_at: string;
    items: { catalog_id: number | null; name: string; quantity: number }[];
  }): Promise<string | null> => {
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/shipments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try {
          const j = JSON.parse(t);
          msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
        } catch {
          msg = t.slice(0, 200);
        }
        return msg;
      }
      await fetchAll();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Failed to record shipment";
    }
  };

  const handleMarkDelivered = async (shipmentId: number) => {
    setActionError(null);
    setActing(`deliver-${shipmentId}`);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/shipments/${shipmentId}/deliver`,
        { method: "POST" }
      );
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try {
          const j = JSON.parse(t);
          msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
        } catch {
          msg = t.slice(0, 200);
        }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to mark delivered");
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

  const handleGenerateFieldLink = async () => {
    setActionError(null);
    setActing("field-link");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/tickets/${reference}/field-sign-link`,
        { method: "POST" }
      );
      if (!res.ok) {
        const txt = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(txt).detail ?? msg; } catch { msg = txt.slice(0, 200); }
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to generate signing link");
    } finally {
      setActing(null);
    }
  };

  // Attempt actions. These throw on failure so AttemptsBlock surfaces the
  // message inline; on success they refetch the detail.
  const parseAttemptErr = async (res: Response): Promise<string> => {
    const t = await res.text();
    try {
      const j = JSON.parse(t);
      return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      return t.slice(0, 200) || `Server ${res.status}`;
    }
  };

  const handleStartAttempt = async () => {
    const res = await authFetch(
      `${API_BASE_URL}/api/v1/admin/tickets/${reference}/attempts`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error(await parseAttemptErr(res));
    await fetchAll();
  };

  const handleEndAttempt = async (attemptId: number) => {
    const res = await authFetch(
      `${API_BASE_URL}/api/v1/admin/tickets/${reference}/attempts/${attemptId}/end`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error(await parseAttemptErr(res));
    await fetchAll();
  };

  const handleAttemptNote = async (body: string, files: File[]) => {
    const fd = new FormData();
    fd.append("body", body);
    for (const f of files) fd.append("images", f, f.name);
    const res = await authFetch(
      `${API_BASE_URL}/api/v1/admin/tickets/${reference}/notes`,
      { method: "POST", body: fd }
    );
    if (!res.ok) throw new Error(await parseAttemptErr(res));
    await fetchAll();
  };

  /* --------------------------- render --------------------------------- */

  if (!ready || !user) return null;

  if (loading) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="h-8 w-64 animate-pulse rounded bg-surface-sunken" />
          <div className="mt-6 h-4 w-96 animate-pulse rounded bg-surface-sunken" />
        </div>
      </AdminShell>
    );
  }

  if (!ticket) {
    // Distinguish a real 404 from a transient load failure — they used to
    // look identical and that misled users into thinking shipments / new
    // features had broken something. Only show "not found" when the server
    // actually said 404; otherwise surface the real error + retry option.
    if (notFound) {
      return (
        <AdminShell>
          <div className="mx-auto max-w-7xl px-6 py-16 text-center">
            <h1 className="font-display text-3xl text-ink">Ticket not found</h1>
            <p className="mt-2 text-ink-muted">No ticket with reference <code>{reference}</code>.</p>
            <Link href="/admin/tickets" className="mt-6 inline-block text-ink underline-offset-2 hover:underline">
              ← Back to tickets
            </Link>
          </div>
        </AdminShell>
      );
    }
    if (forbidden) {
      return (
        <AdminShell>
          <div className="mx-auto max-w-md px-6 py-20 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 10V8a6 6 0 1 1 12 0v2M5 10h14v10H5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="mt-6 font-display text-2xl text-ink">Access restricted</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              Ticket <code className="font-mono text-ink">{reference}</code> isn&apos;t assigned to you, so the details aren&apos;t visible from your account. Only the assigned engineer, managers, and owners can open it.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4">
              <Link
                href="/admin/tickets"
                className="rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink transition-colors hover:border-ink hover:bg-surface-raised"
              >
                ← Your tickets
              </Link>
            </div>
          </div>
        </AdminShell>
      );
    }
    return (
      <AdminShell>
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h1 className="font-display text-3xl text-ink">Couldn&apos;t load ticket</h1>
          <p className="mt-2 text-ink-muted">
            {loadError ?? "Something went wrong while fetching this ticket."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchAll();
              }}
              className="rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
            >
              Retry
            </button>
            <Link href="/admin/tickets" className="text-[13px] text-ink underline-offset-2 hover:underline">
              ← Back to tickets
            </Link>
          </div>
        </div>
      </AdminShell>
    );
  }

  const canModerate = isAdminLevel(user.role) || user.role === "MANAGER";
  // Admin-level = ADMIN or SUPER_ADMIN (general admin powers).
  const adminLevel = isAdminLevel(user.role);
  // Super-admin holds the RESERVED powers: force-close, delete, waive below the
  // service-fee minimum. Plain ADMINs must NOT have these.
  const isSuper = isSuperAdmin(user.role);
  // Remote-support tickets need no signatures, PDF, spare parts or shipments.
  const isRemote = ticket.service_type === "REMOTE_SUPPORT";
  // Third-party tickets: no spare parts or shipments (service charge only), and
  // only the engineer signs. Charges/shipments UI is treated like remote.
  const isThirdParty = ticket.service_type === "THIRD_PARTY_SUPPORT";

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
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
              <Row
                label="Contact"
                value={
                  ticket.contact_person_profile
                    ? `${ticket.contact_name} · ${ticket.contact_person_profile}`
                    : ticket.contact_name
                }
              />
              <Row label="Phone" value={<a className="hover:underline" href={`tel:${ticket.phone}`}>{ticket.phone}</a>} />
              <Row label="Email" value={ticket.email ? <a className="hover:underline" href={`mailto:${ticket.email}`}>{ticket.email}</a> : "—"} />
              {ticket.raised_by ? (
                <Row
                  label="Raised by"
                  value={
                    <span>
                      {ticket.raised_by.name}
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-blue-700">
                        {ticket.raised_by.role === "ENGINEER" ? "Engineer" : ticket.raised_by.role}
                      </span>
                    </span>
                  }
                />
              ) : (
                <Row
                  label="Raised by"
                  value={
                    <span>
                      Customer — {ticket.contact_name}
                      {ticket.contact_person_profile ? ` — ${ticket.contact_person_profile}` : ""}
                    </span>
                  }
                />
              )}
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

            {isThirdParty && (
              <DetailBlock title="Third-party support">
                <Row label="Device name" value={ticket.third_party_device_name || "—"} />
                <Row label="Ticket reference" value={ticket.third_party_ticket_ref || "—"} />
                {ticket.third_party_issue_info && (
                  <div className="px-4 py-3.5">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">Issue info</div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                      {ticket.third_party_issue_info}
                    </p>
                  </div>
                )}
              </DetailBlock>
            )}

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

            {!!ticket.resolution?.media?.length && (
              <DetailBlock title={`Field photos & videos (${ticket.resolution.media.length})`}>
                <div className="grid grid-cols-2 gap-3 px-2 py-2 sm:grid-cols-3">
                  {ticket.resolution.media.map((m) =>
                    m.kind === "video" ? (
                      <a
                        key={m.id}
                        href={m.storage_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block overflow-hidden rounded-lg border border-line bg-black"
                      >
                        <video
                          src={m.storage_url}
                          className="aspect-square w-full object-cover opacity-90"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-soft">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0A0A0A" aria-hidden>
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </span>
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                          Video
                        </span>
                      </a>
                    ) : (
                      <a
                        key={m.id}
                        href={m.storage_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-line"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.storage_url}
                          alt={m.filename}
                          className="aspect-square w-full object-cover transition-transform hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </a>
                    )
                  )}
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
              isAdmin={adminLevel}
              isSuperAdmin={isSuper}
              hasUndeliveredShipments={shipments.some((s) => !s.delivered_at)}
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
              onSelfAssign={handleSelfAssign}
              onWarranty={handleWarranty}
              onServiceType={handleServiceType}
              onThirdPartyInfo={handleThirdPartyInfo}
              onSeverity={handleSeverity}
              onAccept={handleAccept}
              onStartWork={handleStartWork}
              onResolve={handleResolve}
              serviceFeeInr={charges?.service_fee_inr ?? 0}
              serviceFeeMinInr={charges?.service_fee_min_inr ?? 0}
              onEngineerSign={handleEngineerSign}
              onCustomerSign={handleCustomerSign}
              onGenerateFieldLink={handleGenerateFieldLink}
              onDownloadPdf={handleDownloadPdf}
              onRegenPdf={handleRegenPdf}
              defaultPaymentAmount={charges?.grand_total_inr ?? 0}
              onCollectPayment={handleCollectPayment}
            />
            {!isRemote && !isThirdParty && (
              <ShipmentsCard
                shipments={shipments}
                canShip={
                  ticket.status !== "CLOSED" &&
                  (isAdminLevel(user.role) ||
                    user.role === "MANAGER" ||
                    ticket.assigned_engineer?.id === user.id)
                }
                acting={acting}
                onOpenDialog={() => setShipDialogOpen(true)}
                onMarkDelivered={handleMarkDelivered}
              />
            )}
            <AttemptsBlock
              attempts={ticket.attempts ?? []}
              canWork={
                ticket.assigned_engineer?.id === user.id &&
                ticket.status === "RESOLVING"
              }
              canStart={
                ticket.assigned_engineer?.id === user.id &&
                (ticket.status === "ACCEPTED" || ticket.status === "RESOLVING")
              }
              onStart={handleStartAttempt}
              onEnd={handleEndAttempt}
              onAddNote={handleAttemptNote}
            />
            <Spares
              charges={charges}
              catalog={spareCatalog}
              remote={isRemote || isThirdParty}
              canManage={
                // Spares freeze at RESOLVED for non-super-admins — the figures
                // travel into the signed resolution PDF. A Super Admin may
                // correct them at any status, including after the ticket is
                // CLOSED (a post-close billing correction); the PDF re-renders.
                isSuper ||
                (ticket.status === "RESOLVING" &&
                  (isAdminLevel(user.role) ||
                    user.role === "MANAGER" ||
                    ticket.assigned_engineer?.id === user.id))
              }
              canEditFee={
                // A Super Admin may correct the service charge (incl. below the
                // OOW minimum) at any status, including after CLOSED. Everyone
                // else is held to the RESOLVING window.
                isSuper ||
                (ticket.status === "RESOLVING" &&
                  (isAdminLevel(user.role) ||
                    user.role === "MANAGER" ||
                    ticket.assigned_engineer?.id === user.id))
              }
              busy={
                acting === "spare-add" ||
                acting === "spare-remove" ||
                acting === "charges-submit"
              }
              error={spareError}
              canWaiveBelowMin={isSuper}
              onAdd={handleSpareAdd}
              onRemove={handleSpareRemove}
              onSubmitCharges={handleSubmitCharges}
            />
            <SubEngineers
              items={ticket.sub_engineers ?? []}
              canManage={
                (isAdminLevel(user.role) || user.role === "MANAGER" || ticket.assigned_engineer?.id === user.id) &&
                ticket.status !== "OPEN"
              }
              defaultLocation={ticket.city}
              busy={acting === "sub-add" || acting === "sub-remove"}
              roster={roster}
              rosterLoading={rosterLoading}
              onAdd={handleAddSubEngineer}
              onRemove={handleRemoveSubEngineer}
              onSetFee={handleSetSubEngineerFee}
              error={subError}
            />
            {/* Co-assigned app users — shown once a primary engineer exists. */}
            {ticket.assigned_engineer && (
              <AdditionalEngineers
                items={ticket.additional_engineers ?? []}
                engineers={engineers}
                primaryId={ticket.assigned_engineer.id}
                canManage={canModerate && ticket.status !== "CLOSED"}
                busy={acting === "co-eng-add" || acting === "co-eng-remove"}
                matchDistrict={ticket.city}
                onAdd={handleAddCoEngineer}
                onRemove={handleRemoveCoEngineer}
                error={coEngError}
              />
            )}
            {/* Super-admin-only overrides (force-close + soft-delete). */}
            {isSuper && (
              <div className="rounded-xl2 border border-red-200 bg-red-50/40 p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-red-600">
                  Super Admin controls
                </p>
                <div className="mt-3 space-y-2">
                  {ticket.status !== "CLOSED" && (
                    <Button
                      type="button"
                      variant="danger"
                      size="md"
                      className="w-full"
                      onClick={() => setCloseOpen(true)}
                    >
                      Close ticket
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    className="w-full"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete ticket
                  </Button>
                </div>
                <p className="mt-2 text-[11.5px] text-ink-subtle">
                  Closing reviews what&apos;s pending first. Deleting hides the ticket
                  everywhere (recoverable by support).
                </p>
              </div>
            )}

            <Timeline events={events} />
          </aside>
        </div>
      </section>

      <ShipPartsDialog
        open={shipDialogOpen}
        onClose={() => setShipDialogOpen(false)}
        catalog={spareCatalog}
        onSubmit={handleShipParts}
      />

      <CloseTicketDialog
        open={closeOpen}
        reference={reference}
        authFetch={authFetch}
        onClose={() => setCloseOpen(false)}
        onClosed={() => {
          setCloseOpen(false);
          fetchAll();
        }}
      />

      <DeleteTicketDialog
        open={deleteOpen}
        reference={reference}
        authFetch={authFetch}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          router.push("/admin/tickets");
        }}
      />
    </AdminShell>
  );
}

function ShipmentsCard({
  shipments,
  canShip,
  acting,
  onOpenDialog,
  onMarkDelivered,
}: {
  shipments: Shipment[];
  canShip: boolean;
  acting: string | null;
  onOpenDialog: () => void;
  onMarkDelivered: (shipmentId: number) => void;
}) {
  if (shipments.length === 0 && !canShip) return null;
  return (
    <div className="rounded-xl2 border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          Spare parts shipped
        </span>
        {canShip && (
          <button
            type="button"
            onClick={onOpenDialog}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-[12px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M2 5l6 3 6-3M8 8v6" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Ship parts
          </button>
        )}
      </div>
      <ol className="divide-y divide-line/60">
        {shipments.length === 0 ? (
          <li className="px-5 py-4 text-[13px] text-ink-subtle">
            No shipments logged yet.
          </li>
        ) : (
          shipments.map((s) => {
            const delivered = !!s.delivered_at;
            return (
              <li key={s.id} className="px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-[14px] font-medium text-ink">{s.courier_name}</div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] ${
                        delivered
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {delivered ? "Delivered" : "In transit"}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-ink-subtle">
                    Departed {fmtIstDate(s.departed_at)}
                  </div>
                </div>
                {s.tracking_id && (
                  <div className="mt-1 font-mono text-[12.5px] text-ink-muted">
                    Tracking: {s.tracking_id}
                  </div>
                )}
                {s.items.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[13px] text-ink">
                    {s.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-2">
                        <span>{it.name}</span>
                        <span className="text-ink-subtle">× {it.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11.5px] text-ink-subtle">
                    {delivered && s.delivered_at ? (
                      <>
                        Delivered {fmtIst(s.delivered_at)}
                        {s.created_by && <> · Shipped by {s.created_by.name}</>}
                      </>
                    ) : (
                      s.created_by && <>Logged by {s.created_by.name}</>
                    )}
                  </div>
                  {canShip && !delivered && (
                    <button
                      type="button"
                      onClick={() => onMarkDelivered(s.id)}
                      disabled={acting === `deliver-${s.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-[12px] text-ink hover:border-ink hover:bg-surface-raised transition-colors disabled:opacity-50"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {acting === `deliver-${s.id}` ? "Marking…" : "Mark delivered"}
                    </button>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ol>
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
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasUndeliveredShipments: boolean;
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
  onSelfAssign: () => void;
  onWarranty: (next: string) => void;
  onServiceType: (next: string) => void;
  onThirdPartyInfo: (payload: {
    third_party_device_name: string;
    third_party_issue_info: string;
    third_party_ticket_ref: string;
  }) => void | Promise<void>;
  onSeverity: (next: string) => void;
  onAccept: () => void;
  onStartWork: () => void;
  onResolve: (serviceFeeInr: number) => void;
  serviceFeeInr: number;
  serviceFeeMinInr: number;
  onEngineerSign: (blob: Blob) => Promise<void> | void;
  onCustomerSign: (blob: Blob, signerName: string) => Promise<void> | void;
  onGenerateFieldLink: () => void | Promise<void>;
  onDownloadPdf: () => void | Promise<void>;
  onRegenPdf: () => void | Promise<void>;
  defaultPaymentAmount: number;
  onCollectPayment: (amount: number) => void | Promise<void>;
}) {
  const {
    ticket, engineers, currentUserId, currentUserRole, canModerate, isAdmin,
    isSuperAdmin,
    hasUndeliveredShipments,
    acting, actionError, selectedEngineerId, setSelectedEngineerId,
    resolveSummary, setResolveSummary, showResolveForm, setShowResolveForm,
    onAcknowledge, onAssign, onSelfAssign, onWarranty, onServiceType, onThirdPartyInfo, onSeverity,
    onAccept, onStartWork, onResolve, serviceFeeInr, serviceFeeMinInr,
    onEngineerSign, onCustomerSign,
    onGenerateFieldLink, onDownloadPdf, onRegenPdf,
    defaultPaymentAmount, onCollectPayment,
  } = props;
  const [resolveFeeDraft, setResolveFeeDraft] = useState("");
  const signPadRef = useRef<SignaturePadHandle>(null);
  const [signEmpty, setSignEmpty] = useState(true);
  // null = show defaultPaymentAmount (the billable total) until the user edits.
  const [paymentDraft, setPaymentDraft] = useState<string | null>(null);

  // Customer signature capture (on engineer's device)
  const custPadRef = useRef<SignaturePadHandle>(null);
  const [custEmpty, setCustEmpty] = useState(true);
  const [custName, setCustName] = useState("");

  // Pre-fill the customer name field once the ticket loads
  useEffect(() => {
    if (!custName && ticket.contact_name) setCustName(ticket.contact_name);
  }, [ticket.contact_name, custName]);

  // Third-party support details (editable until the ticket is closed). Kept in
  // sync with the ticket so a save (which refetches) reflects the stored values.
  const [tpDevice, setTpDevice] = useState(ticket.third_party_device_name ?? "");
  const [tpIssue, setTpIssue] = useState(ticket.third_party_issue_info ?? "");
  const [tpRef, setTpRef] = useState(ticket.third_party_ticket_ref ?? "");
  useEffect(() => {
    setTpDevice(ticket.third_party_device_name ?? "");
    setTpIssue(ticket.third_party_issue_info ?? "");
    setTpRef(ticket.third_party_ticket_ref ?? "");
  }, [ticket.third_party_device_name, ticket.third_party_issue_info, ticket.third_party_ticket_ref]);

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
  const canAssign =
    canModerate && ["ACKNOWLEDGED", "ASSIGNED", "ACCEPTED", "RESOLVING"].includes(ticket.status);
  // Warranty must be decided before assigning. Mirrors the backend gate so the
  // user sees why assigning is blocked instead of hitting a 400.
  const warrantyUnknown = ticket.warranty_status === "UNKNOWN";
  const isRemote = ticket.service_type === "REMOTE_SUPPORT";
  // Third-party support: engineer signature only (no customer signature), and
  // no spares (service charge only). Charges UI is treated like remote.
  const isThirdParty = ticket.service_type === "THIRD_PARTY_SUPPORT";

  // Engineer-style actions (accept / start / resolve / sign) are available to
  // whoever the ticket is currently assigned to — engineer, owner, or manager
  // who self-assigned.
  const isMyTicket = ticket.assigned_engineer?.id === currentUserId;
  const canAccept = isMyTicket && ticket.status === "ASSIGNED";
  const canStart = isMyTicket && ticket.status === "ACCEPTED";
  const canResolve = isMyTicket && ticket.status === "RESOLVING";
  // Resolving requires at least one completed attempt and none still open.
  const openAttempt = (ticket.attempts ?? []).find((a) => !a.ended_at) ?? null;
  const endedAttempts = (ticket.attempts ?? []).filter((a) => a.ended_at).length;
  const attemptsReady = !openAttempt && endedAttempts > 0;

  // A mid-resolution ticket can be reassigned to another engineer, but not
  // while the current engineer still has an attempt open — the backend rejects
  // it (409), so surface the reason and block the button up front.
  const reassignBlockedByOpenAttempt =
    ticket.status === "RESOLVING" && !!ticket.assigned_engineer && !!openAttempt;

  // Sub-engineers can be added once ticket is acknowledged, by assignee / Admin / Manager.
  const isAssignee = ticket.assigned_engineer?.id === currentUserId;
  const canManageSubEngineers =
    (canModerate || isAssignee) &&
    ticket.status !== "OPEN";

  // Signing state — both signatures collected in-app, or remotely via a
  // sub-engineer link for tickets resolved away from base.
  const customerSigned = !!ticket.resolution?.customer_signed_at;
  const engineerSigned = !!ticket.resolution?.engineer_signed_at;
  // Remote field-signing: once the link is generated, on-site signing locks.
  const fieldMode = !!ticket.resolution?.field_sign_link_generated_at;
  const hasSubEngineer = (ticket.sub_engineers?.length ?? 0) > 0;
  const fieldSignToken = ticket.resolution?.customer_sign_token ?? "";
  const fieldSignUrl =
    fieldSignToken && typeof window !== "undefined"
      ? `${window.location.origin}/field-sign/${fieldSignToken}`
      : "";
  // Engineer captures customer's signature on their device first…
  // (Third-party tickets skip the customer signature entirely.)
  const canCaptureCustomer =
    !isThirdParty && isMyTicket && ticket.status === "RESOLVED" && !customerSigned && !fieldMode;
  // …then signs themselves to close the ticket. On third-party tickets the
  // engineer signs directly, with no customer signature required first.
  const canEngineerSign =
    isMyTicket &&
    ticket.status === "RESOLVED" &&
    (isThirdParty || customerSigned) &&
    !engineerSigned &&
    !fieldMode;
  // Generate the remote sub-engineer signing link — only once a sub-engineer
  // is on the ticket and signing hasn't started on-site. Not for third-party
  // (that flow collects a customer signature, which third-party doesn't use).
  const canGenerateFieldLink =
    !isThirdParty &&
    (isMyTicket || canModerate) &&
    ticket.status === "RESOLVED" &&
    hasSubEngineer &&
    !fieldMode &&
    !customerSigned &&
    !engineerSigned;
  const canDownloadPdf =
    (isAdmin || currentUserRole === "MANAGER" || isMyTicket) &&
    ticket.status === "CLOSED" &&
    !!ticket.resolution?.pdf_generated_at;

  // `payment_required` is computed by the backend (OOW, or covered + charges).
  // Out-of-warranty additionally requires a positive amount.
  const paymentPending =
    !!ticket.payment_required &&
    ticket.status === "RESOLVED" &&
    ticket.payment_status === "PENDING";
  const paymentCollected = ticket.payment_status === "COLLECTED";
  const canCollectPayment = canModerate || isAssignee;
  // Remote-support tickets have no signatures, so payment can be collected as
  // soon as they're RESOLVED (isRemote is declared above). Site visits collect
  // after both signatures.
  // Money breakdown for partial payments. Falls back to the charges total when
  // the backend hasn't sent the new fields yet (pre-deploy).
  const amountDue = ticket.amount_due_inr ?? defaultPaymentAmount;
  const amountCollected = ticket.amount_collected_inr ?? 0;
  const amountPending = ticket.amount_pending_inr ?? Math.max(0, amountDue - amountCollected);

  const hasAnyAction =
    canAcknowledge || canAssign || isAdmin || canAccept || canStart || canResolve ||
    canCaptureCustomer || canEngineerSign || canGenerateFieldLink || canDownloadPdf ||
    paymentPending ||
    (ticket.status === "RESOLVED" && !!ticket.resolution);
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
            {ticket.assigned_engineer ? "Reassign to someone else" : "Assign to"}
          </label>
          <EngineerPicker
            engineers={engineers}
            selectedId={selectedEngineerId}
            onChange={setSelectedEngineerId}
            // When reassigning, hide the person currently on the ticket — reassigning
            // to the same person isn't a meaningful action.
            excludeId={ticket.assigned_engineer?.id ?? null}
            // Surface engineers covering this ticket's city/district first.
            matchDistrict={ticket.city}
            placeholder="Choose assignee"
          />
          {warrantyUnknown && (
            <p className="mt-3 rounded-xl2 border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
              Set the warranty status (Under Warranty / Out of Warranty / AMC)
              before assigning this ticket.
            </p>
          )}
          {reassignBlockedByOpenAttempt && (
            <p className="mt-3 rounded-xl2 border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
              {ticket.assigned_engineer?.name ?? "The current engineer"} has a
              work attempt still in progress. Ask them to end their current
              attempt before this ticket can be reassigned.
            </p>
          )}
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={acting === "assign"}
            disabled={warrantyUnknown || reassignBlockedByOpenAttempt}
            onClick={onAssign}
            className="mt-3 w-full"
          >
            {ticket.assigned_engineer ? "Reassign engineer" : "Assign engineer"}
          </Button>

          {canModerate && ticket.assigned_engineer?.id !== currentUserId && (
            <button
              type="button"
              onClick={onSelfAssign}
              disabled={acting === "self-assign" || warrantyUnknown}
              className="mt-2 block w-full rounded-md px-2 py-1.5 text-center text-[12.5px] text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              {acting === "self-assign" ? "Assigning to you…" : "or, assign to me"}
            </button>
          )}
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

      {canResolve && !attemptsReady && (
        <div className="rounded-md border border-line bg-surface-raised p-3 text-[12.5px] text-ink-muted">
          {openAttempt
            ? "End the open attempt in Work attempts below before resolving."
            : "Log at least one attempt in Work attempts below before resolving."}
        </div>
      )}

      {canResolve && attemptsReady && (
        <div>
          {!showResolveForm ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                setResolveFeeDraft(String(serviceFeeInr));
                setShowResolveForm(true);
              }}
              className="w-full"
            >
              {isRemote ? "Resolve & close" : "Mark resolved"}
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
              {/* Confirm the service charge before resolving — this is the
                  amount billed on the resolution/PDF. Editable here as a final
                  check; only committed when the engineer presses Confirm. */}
              <div>
                <label className="block text-[12.5px] font-medium text-ink">
                  Service charge (₹)
                </label>
                <input
                  type="number"
                  min={isSuperAdmin ? 0 : serviceFeeMinInr}
                  value={resolveFeeDraft}
                  onChange={(e) => setResolveFeeDraft(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-right text-[13.5px] text-ink
                             focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                />
                {serviceFeeMinInr > 0 && (
                  <p className="mt-1 text-[12px] text-ink-subtle">
                    Minimum ₹{serviceFeeMinInr.toLocaleString("en-IN")}
                    {isSuperAdmin && " · you can set lower"}
                  </p>
                )}
              </div>
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
                  onClick={() => {
                    // Pass the entered amount as-is; handleResolve rejects a
                    // below-minimum value (non-Admin) rather than clamping it.
                    const fee = parseInt(resolveFeeDraft || "0", 10) || 0;
                    onResolve(fee);
                  }}
                  className="flex-1"
                >
                  Confirm
                </Button>
              </div>
              <p className="text-[12px] text-ink-subtle">
                {isRemote
                  ? "Remote support — this resolves and closes the ticket immediately. No signatures or PDF."
                  : isThirdParty
                  ? "After resolving, add your engineer signature to close the ticket. No customer signature is needed."
                  : "After resolving, capture the customer + engineer signatures to close the ticket."}
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
            {!isThirdParty && (
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${customerSigned ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className="text-ink">
                  Customer: {customerSigned ? (
                    <>signed by <strong>{ticket.resolution.customer_signer_name}</strong></>
                  ) : "awaiting signature"}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${engineerSigned ? "bg-emerald-500" : "bg-neutral-300"}`} />
              <span className="text-ink">
                {fieldMode ? "Sub-engineer" : "Engineer"}:{" "}
                {engineerSigned ? (
                  ticket.resolution.engineer_signer_name ? (
                    <>signed by <strong>{ticket.resolution.engineer_signer_name}</strong></>
                  ) : (
                    "signed"
                  )
                ) : (
                  "pending"
                )}
              </span>
            </div>
          </div>
          {fieldMode && !engineerSigned && (
            <p className="mt-3 text-[12px] text-ink-subtle">
              Waiting for the sub-engineer to submit both signatures via the shared link.
            </p>
          )}
          {!isThirdParty && !fieldMode && !customerSigned && !canCaptureCustomer && (
            <p className="mt-3 text-[12px] text-ink-subtle">
              The assigned engineer captures the customer&apos;s signature on-site.
            </p>
          )}
        </div>
      )}

      {/* ------------------- payment (partial-aware) -------------------- */}
      {paymentPending && (() => {
        // Collect is available for remote tickets once RESOLVED, and for site
        // visits once both signatures are in. The amount entered must be
        // 1..pending; the ticket closes only when the balance reaches ₹0.
        const canCollectNow =
          isRemote || (isThirdParty ? engineerSigned : customerSigned && engineerSigned);
        const draftNum = parseInt((paymentDraft ?? String(amountPending)) || "0", 10);
        const validDraft = draftNum > 0 && draftNum <= amountPending;
        const clearsBalance = draftNum === amountPending;
        return (
          <div className="border-t border-line pt-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-amber-700">
                Payment pending
              </span>
            </div>
            <div className="mt-2 text-[12.5px] text-ink-muted">
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                <span>Total due: <span className="font-medium text-ink">₹{amountDue.toLocaleString("en-IN")}</span></span>
                {amountCollected > 0 && (
                  <span>Collected: <span className="font-medium text-ink">₹{amountCollected.toLocaleString("en-IN")}</span></span>
                )}
                <span>Pending: <span className="font-medium text-amber-700">₹{amountPending.toLocaleString("en-IN")}</span></span>
              </div>
              {!canCollectNow && (
                <p className="mt-1">Collect the balance after sign-off to close the ticket.</p>
              )}
            </div>
            {canCollectNow && canCollectPayment && (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-ink-subtle">₹</span>
                  <input
                    type="number"
                    min={1}
                    max={amountPending}
                    value={paymentDraft ?? String(amountPending)}
                    onChange={(e) => setPaymentDraft(e.target.value)}
                    className="w-28 rounded-md border border-line bg-white px-2 py-1 text-right text-[13.5px] text-ink
                               focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    loading={acting === "collect-payment"}
                    disabled={!validDraft}
                    onClick={() => {
                      if (validDraft) {
                        void onCollectPayment(draftNum);
                        setPaymentDraft(null);
                      }
                    }}
                  >
                    {clearsBalance ? "Collect & close" : "Collect part-payment"}
                  </Button>
                </div>
                {!validDraft && (
                  <p className="mt-1.5 text-[12px] text-red-600">
                    Enter an amount between ₹1 and ₹{amountPending.toLocaleString("en-IN")}.
                  </p>
                )}
                {validDraft && !clearsBalance && (
                  <p className="mt-1.5 text-[12px] text-ink-subtle">
                    ₹{(amountPending - draftNum).toLocaleString("en-IN")} will remain pending — the ticket stays open until paid in full.
                  </p>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Payment collected confirmation */}
      {paymentCollected && ticket.payment_amount_inr != null && (
        <div className="border-t border-line pt-5">
          <p className="text-[12.5px] text-emerald-700">
            Payment collected · ₹{ticket.payment_amount_inr.toLocaleString("en-IN")}
            {ticket.payment_collected_by ? ` by ${ticket.payment_collected_by.name}` : ""}
          </p>
        </div>
      )}

      {/* ------------------- remote sub-engineer signing -------------------- */}
      {canGenerateFieldLink && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
            Remote signing
          </p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Generate a no-login link and send it to the sub-engineer. They collect
            the customer&apos;s signature and their own to close the ticket.
            Generating the link disables on-site signing here.
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={acting === "field-link"}
            onClick={onGenerateFieldLink}
            className="mt-3 w-full"
          >
            Generate sub-engineer signing link
          </Button>
        </div>
      )}

      {fieldMode && !engineerSigned && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
            Sub-engineer signing link
          </p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Send this link to the sub-engineer (WhatsApp, SMS, email). It opens
            without a login. On-site signing is disabled while it&apos;s active.
          </p>
          <CopyableLink url={fieldSignUrl} />
          {hasUndeliveredShipments && (
            <p className="mt-3 rounded-xl2 border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
              Spare parts are still in transit — the sub-engineer can&apos;t
              submit until every shipment is marked delivered.
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
            {isThirdParty ? "Engineer signature" : "Step 2 · Your countersignature"}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Signing will close the ticket and generate the resolution PDF.
          </p>
          <div className="mt-3">
            <SignaturePad ref={signPadRef} onChangeIsEmpty={setSignEmpty} height={160} />
          </div>
          {hasUndeliveredShipments && (
            <p className="mt-3 rounded-xl2 border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
              Spare parts are still in transit. Mark every shipment delivered
              before closing the ticket.
            </p>
          )}
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={signEmpty || hasUndeliveredShipments}
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
          <button
            type="button"
            onClick={onRegenPdf}
            disabled={acting === "pdf-regen"}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink hover:border-ink hover:bg-surface-raised transition-colors disabled:opacity-50"
            title="Re-render the PDF in place (useful after a template update)"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8a5 5 0 0 1 8.5-3.5L14 3M13 8a5 5 0 0 1-8.5 3.5L2 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 3v3h-3M2 13v-3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {acting === "pdf-regen" ? "Regenerating…" : "Regenerate PDF"}
          </button>
        </div>
      )}

      {!canAcknowledge && !canAssign && !canAccept && !canStart && !canResolve &&
       !canCaptureCustomer && !canEngineerSign && !canDownloadPdf && ticket.status !== "RESOLVED" && (
        <p className="text-[13px] text-ink-muted">
          No actions available at status <strong>{ticket.status}</strong>.
        </p>
      )}

      {/* Severity — Admin + Manager */}
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

      {canModerate && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">Warranty</p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Admin or Manager can change this.
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
                  {w === "UNDER_WARRANTY" ? "In warranty" : w === "OUT_OF_WARRANTY" ? "Out of warranty" : w === "AMC" ? "AMC" : "Unknown"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(canModerate || isMyTicket) && (
        <div className="border-t border-line pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">Service type</p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Remote support skips signatures, PDF and spare parts, and closes in one step.
            Third-party support closes on your signature alone (no customer signature).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SERVICE_TYPE_OPTIONS.map((opt) => {
              const active = ticket.service_type === opt.value;
              const locked = ["RESOLVED", "CLOSED"].includes(ticket.status);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={locked || acting?.startsWith("service-type")}
                  onClick={() => onServiceType(opt.value)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink-soft"
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Third-party support details — editable until the ticket is closed.
              Device name + issue info are required to close (backend enforced). */}
          {ticket.service_type === "THIRD_PARTY_SUPPORT" && (
            <div className="mt-4 space-y-2.5">
              <label className="block">
                <span className="text-[11.5px] text-ink-subtle">Third-party device name *</span>
                <input
                  type="text"
                  value={tpDevice}
                  onChange={(e) => setTpDevice(e.target.value)}
                  disabled={ticket.status === "CLOSED"}
                  placeholder="e.g. Epson TM-T88 printer"
                  className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="text-[11.5px] text-ink-subtle">Issue info *</span>
                <textarea
                  value={tpIssue}
                  onChange={(e) => setTpIssue(e.target.value)}
                  disabled={ticket.status === "CLOSED"}
                  rows={2}
                  placeholder="Describe the third-party device issue"
                  className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="text-[11.5px] text-ink-subtle">Third-party ticket reference (optional)</span>
                <input
                  type="text"
                  value={tpRef}
                  onChange={(e) => setTpRef(e.target.value)}
                  disabled={ticket.status === "CLOSED"}
                  placeholder="Reference no. in the third party's system"
                  className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink disabled:opacity-50"
                />
              </label>
              {ticket.status !== "CLOSED" && (
                <button
                  type="button"
                  disabled={acting === "third-party-info"}
                  onClick={() =>
                    onThirdPartyInfo({
                      third_party_device_name: tpDevice.trim(),
                      third_party_issue_info: tpIssue.trim(),
                      third_party_ticket_ref: tpRef.trim(),
                    })
                  }
                  className="rounded-md border border-ink bg-ink px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
                >
                  {acting === "third-party-info" ? "Saving…" : "Save third-party details"}
                </button>
              )}
            </div>
          )}
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

function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the user can still select the text manually.
    }
  };
  return (
    <div className="mt-3 flex items-stretch gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-xl2 border border-line bg-surface-raised px-3 py-2 font-mono text-[12px] text-ink"
      />
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-xl2 border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-ink transition-colors hover:border-ink hover:bg-surface-raised"
      >
        {copied ? "Copied" : "Copy"}
      </button>
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
    case "ENGINEER_ADDED":
      return `Added ${(e.payload as { engineer_name?: string } | null)?.engineer_name ?? "engineer"} as co-engineer`;
    case "ENGINEER_REMOVED":
      return `Removed ${(e.payload as { engineer_name?: string } | null)?.engineer_name ?? "engineer"} from co-engineers`;
    case "WARRANTY_UPDATED":
      return `Warranty ${(e.payload as { from?: string; to?: string } | null)?.from} → ${(e.payload as { from?: string; to?: string } | null)?.to}`;
    case "ACCEPTED": return "Accepted by engineer";
    case "RESOLVING_STARTED": return "Started resolving";
    case "RESOLVED": return "Marked resolved";
    case "FIELD_SIGN_LINK_GENERATED": return "Remote signing link generated";
    case "CUSTOMER_SIGNED": {
      const p = (e.payload as { signer_name?: string } | null) ?? {};
      return p.signer_name ? `Customer signed (${p.signer_name})` : "Customer signed";
    }
    case "ENGINEER_SIGNED": return "Engineer signed";
    case "SUB_ENGINEER_SIGNED": {
      const p = (e.payload as { signer_name?: string } | null) ?? {};
      return p.signer_name ? `Sub-engineer signed (${p.signer_name})` : "Sub-engineer signed";
    }
    case "CLOSED": return "Closed";
    case "FORCE_CLOSED": {
      const p = (e.payload as { reason?: string } | null) ?? {};
      return p.reason ? `Force-closed by admin — ${p.reason}` : "Force-closed by admin";
    }
    case "DELETED": {
      const p = (e.payload as { reason?: string } | null) ?? {};
      return p.reason ? `Deleted by admin — ${p.reason}` : "Deleted by admin";
    }
    case "PARTS_SHIPPED": {
      const p = (e.payload as { courier?: string; item_count?: number } | null) ?? {};
      const items = p.item_count ? ` (${p.item_count} item${p.item_count === 1 ? "" : "s"})` : "";
      return p.courier ? `Parts shipped via ${p.courier}${items}` : `Parts shipped${items}`;
    }
    case "PARTS_DELIVERED": {
      const p = (e.payload as { courier?: string } | null) ?? {};
      return p.courier ? `Shipment delivered (${p.courier})` : "Shipment delivered";
    }
    default: return e.event_type;
  }
}

function timeFmt(iso: string): string {
  return fmtIst(iso);
}
