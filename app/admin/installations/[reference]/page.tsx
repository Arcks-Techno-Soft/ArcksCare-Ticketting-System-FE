"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/Button";
import { Textarea, Label } from "@/components/ui/Field";
import { EngineerPicker, type Engineer } from "@/components/admin/engineer-picker";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import {
  NoteAttachmentGrid,
  NoteImagePicker,
  type NoteAttachmentView,
  type PickedImage,
} from "@/components/admin/note-images";
import { fmtIst } from "@/lib/format-date";

type Installation = {
  id: number;
  reference: string;
  business_name: string;
  business_category: string;
  contact_name: string;
  phone: string;
  email?: string | null;
  invoice_number: string;
  status: string;
  created_by?: Engineer | null;
  assigned_by?: Engineer | null;
  assigned_engineer?: Engineer | null;
  assigned_at?: string | null;
  completed_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  resolution?: {
    id: number;
    customer_signer_name?: string | null;
    customer_signed_at?: string | null;
    engineer_signed_at?: string | null;
    pdf_generated_at?: string | null;
    customer_sign_token: string;
  } | null;
};

type Note = {
  id: number;
  body: string;
  created_at: string;
  author: { id: number; name: string; role: string; username: string };
  attachments?: NoteAttachmentView[];
};

type InstallEvent = {
  id: number;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
  actor?: { id: number; name: string; role: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-amber-50 text-amber-800 border-amber-200",
  ASSIGNED: "bg-blue-50 text-blue-800 border-blue-200",
  COMPLETED: "bg-violet-50 text-violet-800 border-violet-200",
  CLOSED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export default function InstallationDetailPage() {
  const router = useRouter();
  const params = useParams<{ reference: string }>();
  const reference = params?.reference?.toString() ?? "";
  const { ready, user, authFetch } = useAuth();

  const [inst, setInst] = useState<Installation | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<InstallEvent[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEngineerId, setSelectedEngineerId] = useState<number | null>(null);
  const [newNote, setNewNote] = useState("");
  const [noteImages, setNoteImages] = useState<PickedImage[]>([]);

  useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  const fetchAll = useCallback(async () => {
    if (!reference) return;
    try {
      const [i, n, e, eng] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/v1/admin/installations/${reference}`),
        authFetch(`${API_BASE_URL}/api/v1/admin/installations/${reference}/notes`),
        authFetch(`${API_BASE_URL}/api/v1/admin/installations/${reference}/events`),
        authFetch(`${API_BASE_URL}/api/v1/admin/engineers`),
      ]);
      if (i.status === 404) {
        setInst(null);
        setLoading(false);
        return;
      }
      if (!i.ok) throw new Error(`Server ${i.status}`);
      setInst(await i.json());
      setNotes(n.ok ? await n.json() : []);
      setEvents(e.ok ? await e.json() : []);
      setEngineers(eng.ok ? await eng.json() : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [reference, authFetch]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAll();
  }, [user, fetchAll]);

  const callAction = async (
    label: string,
    endpoint: string,
    method: "POST" | "PATCH" = "POST",
    body?: unknown
  ) => {
    setError(null);
    setActing(label);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/installations/${reference}${endpoint}`,
        {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
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
        throw new Error(msg);
      }
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  const handleAssign = () => {
    if (!selectedEngineerId) {
      setError("Pick an engineer first.");
      return;
    }
    callAction("assign", "/assign", "POST", { engineer_id: selectedEngineerId });
    setSelectedEngineerId(null);
  };

  const handleSelfAssign = () => callAction("self-assign", "/self-assign");

  const handleAddNote = async () => {
    const body = newNote.trim();
    if (body.length < 2) return;
    setError(null);
    setActing("note");
    try {
      const fd = new FormData();
      fd.append("body", body);
      for (const p of noteImages) fd.append("images", p.file, p.file.name);
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/installations/${reference}/notes`,
        { method: "POST", body: fd }
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
      setNewNote("");
      noteImages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setNoteImages([]);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note failed");
    } finally {
      setActing(null);
    }
  };

  const handleClose = () => {
    if (!confirm("Mark this installation as complete? You'll then capture both signatures.")) return;
    callAction("close", "/close");
  };

  const handleCustomerSign = async (blob: Blob, signerName: string) => {
    setError(null);
    setActing("customer-sign");
    try {
      const fd = new FormData();
      fd.append("signer_name", signerName.trim());
      fd.append("signature", blob, "customer-signature.png");
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/installations/${reference}/sign-customer`,
        { method: "POST", body: fd }
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
      setError(e instanceof Error ? e.message : "Customer signature failed");
    } finally {
      setActing(null);
    }
  };

  const handleEngineerSign = async (blob: Blob) => {
    setError(null);
    setActing("engineer-sign");
    try {
      const fd = new FormData();
      fd.append("signature", blob, "engineer-signature.png");
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/installations/${reference}/sign-engineer`,
        { method: "POST", body: fd }
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
      setError(e instanceof Error ? e.message : "Engineer signature failed");
    } finally {
      setActing(null);
    }
  };

  const handleDownloadPdf = async () => {
    setError(null);
    setActing("pdf");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/installations/${reference}/pdf`
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
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setActing(null);
    }
  };

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

  if (!inst) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h1 className="font-display text-3xl text-ink">Installation not found</h1>
          <p className="mt-2 text-ink-muted">
            No installation with reference <code>{reference}</code>.
          </p>
          <Link
            href="/admin/installations"
            className="mt-6 inline-block text-ink underline-offset-2 hover:underline"
          >
            ← Back to installations
          </Link>
        </div>
      </AdminShell>
    );
  }

  const canModerate = user.role === "OWNER" || user.role === "MANAGER";
  const isAssignee = inst.assigned_engineer?.id === user.id;
  const canAssign = canModerate && (inst.status === "NEW" || inst.status === "ASSIGNED");
  const canAddNote = (canModerate || isAssignee) && inst.status === "ASSIGNED";
  const canClose = isAssignee && inst.status === "ASSIGNED";
  const customerSigned = !!inst.resolution?.customer_signed_at;
  const engineerSigned = !!inst.resolution?.engineer_signed_at;
  const canCaptureCustomer = isAssignee && inst.status === "COMPLETED" && !customerSigned;
  const canEngineerSign =
    isAssignee && inst.status === "COMPLETED" && customerSigned && !engineerSigned;
  const canDownloadPdf =
    canModerate && inst.status === "CLOSED" && !!inst.resolution?.pdf_generated_at;

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin/installations"
            className="text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            ← All installations
          </Link>
          <button
            type="button"
            onClick={fetchAll}
            className="text-[12.5px] text-ink-muted hover:text-ink transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="font-mono text-[12.5px] text-ink-subtle">{inst.reference}</p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tightest text-ink">
              {inst.business_name}
            </h1>
            <p className="mt-1 text-[14.5px] text-ink-muted">
              {inst.business_category} · Invoice {inst.invoice_number}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium ${
              STATUS_STYLES[inst.status] ??
              "bg-neutral-50 text-neutral-700 border-neutral-200"
            }`}
          >
            {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
          </span>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-10">
            <DetailBlock title="Customer">
              <Row label="Business" value={`${inst.business_name} · ${inst.business_category}`} />
              <Row label="Contact" value={inst.contact_name} />
              <Row
                label="Phone"
                value={
                  <a className="hover:underline" href={`tel:${inst.phone}`}>
                    {inst.phone}
                  </a>
                }
              />
              {inst.email && (
                <Row
                  label="Email"
                  value={
                    <a className="hover:underline" href={`mailto:${inst.email}`}>
                      {inst.email}
                    </a>
                  }
                />
              )}
              <Row label="Invoice #" value={<code className="font-mono text-[13.5px]">{inst.invoice_number}</code>} />
            </DetailBlock>

            <DetailBlock title="Assignment">
              <Row
                label="Engineer"
                value={inst.assigned_engineer?.name ?? <span className="text-ink-subtle">Not assigned</span>}
              />
              {inst.assigned_at && (
                <Row label="Assigned at" value={fmtIst(inst.assigned_at)} />
              )}
              {inst.completed_at && (
                <Row label="Completed at" value={fmtIst(inst.completed_at)} />
              )}
              {inst.closed_at && (
                <Row label="Closed at" value={fmtIst(inst.closed_at)} />
              )}
            </DetailBlock>

            <NotesBlock
              notes={notes}
              canAdd={canAddNote}
              busy={acting === "note"}
              draft={newNote}
              setDraft={setNewNote}
              images={noteImages}
              setImages={setNoteImages}
              onAdd={handleAddNote}
            />

            <Timeline events={events} />
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl2 border border-line bg-white p-5 shadow-soft">
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">Actions</p>
              <h3 className="mt-1 font-display text-xl font-medium tracking-tight text-ink">
                What&apos;s next?
              </h3>

              {/* Assign */}
              {canAssign && (
                <div className="mt-5">
                  {inst.assigned_engineer && (
                    <div className="mb-3 rounded-md border border-line bg-surface-raised px-3 py-2.5">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                        Currently assigned
                      </div>
                      <div className="mt-0.5 text-[13.5px] font-medium text-ink">
                        {inst.assigned_engineer.name}
                      </div>
                    </div>
                  )}
                  <Label>{inst.assigned_engineer ? "Reassign to" : "Assign to"}</Label>
                  <EngineerPicker
                    engineers={engineers}
                    selectedId={selectedEngineerId}
                    onChange={setSelectedEngineerId}
                    excludeId={inst.assigned_engineer?.id ?? null}
                    placeholder="Choose engineer"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    loading={acting === "assign"}
                    onClick={handleAssign}
                    className="mt-3 w-full"
                  >
                    {inst.assigned_engineer ? "Reassign engineer" : "Assign engineer"}
                  </Button>
                  {inst.assigned_engineer?.id !== user.id && (
                    <button
                      type="button"
                      onClick={handleSelfAssign}
                      disabled={acting === "self-assign"}
                      className="mt-2 block w-full rounded-md px-2 py-1.5 text-center text-[12.5px] text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                    >
                      {acting === "self-assign" ? "Assigning to you…" : "or, assign to me"}
                    </button>
                  )}
                </div>
              )}

              {/* Close button */}
              {canClose && (
                <div className="mt-5 border-t border-line pt-5">
                  <p className="text-[12.5px] text-ink-muted">
                    When the install is done on-site, close it. You&apos;ll capture both
                    signatures next.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    loading={acting === "close"}
                    onClick={handleClose}
                    className="mt-3 w-full"
                  >
                    Close installation
                  </Button>
                </div>
              )}

              {/* Signatures status */}
              {inst.status === "COMPLETED" && inst.resolution && (
                <div className="mt-5 border-t border-line pt-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                    Signatures
                  </p>
                  <div className="mt-2 space-y-1.5 text-[13px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          customerSigned ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="text-ink">
                        Customer:{" "}
                        {customerSigned ? (
                          <>
                            signed by <strong>{inst.resolution.customer_signer_name}</strong>
                          </>
                        ) : (
                          "awaiting signature"
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          engineerSigned ? "bg-emerald-500" : "bg-neutral-300"
                        }`}
                      />
                      <span className="text-ink">
                        Engineer: {engineerSigned ? "signed" : "pending"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {canCaptureCustomer && (
                <CustomerSignBox
                  defaultName={inst.contact_name}
                  busy={acting === "customer-sign"}
                  onSubmit={handleCustomerSign}
                />
              )}

              {canEngineerSign && (
                <EngineerSignBox
                  busy={acting === "engineer-sign"}
                  onSubmit={handleEngineerSign}
                />
              )}

              {canDownloadPdf && (
                <div className="mt-5 border-t border-line pt-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                    Installation record
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    loading={acting === "pdf"}
                    onClick={handleDownloadPdf}
                    className="mt-3 w-full"
                  >
                    Open PDF
                  </Button>
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-md border border-accent-danger/30 bg-white p-3 text-[12.5px] text-accent-danger"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </div>
      </section>
    </AdminShell>
  );
}

/* ---------- subcomponents ---------- */

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

function NotesBlock({
  notes,
  canAdd,
  busy,
  draft,
  setDraft,
  images,
  setImages,
  onAdd,
}: {
  notes: Note[];
  canAdd: boolean;
  busy: boolean;
  draft: string;
  setDraft: (s: string) => void;
  images: PickedImage[];
  setImages: (next: PickedImage[]) => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl2 border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          Work notes
        </span>
        <span className="text-[11px] text-ink-subtle">Internal only</span>
      </div>

      <ol className="divide-y divide-line/60">
        {notes.length === 0 ? (
          <li className="px-5 py-4 text-[13px] text-ink-subtle">No notes yet.</li>
        ) : (
          notes.map((n) => (
            <li key={n.id} className="px-5 py-3.5">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                {n.body}
              </p>
              {n.attachments && n.attachments.length > 0 && (
                <NoteAttachmentGrid attachments={n.attachments} />
              )}
              <p className="mt-1 text-[11.5px] text-ink-subtle">
                {n.author.name}
                <span className="mx-1">·</span>
                {fmtIst(n.created_at)}
              </p>
            </li>
          ))
        )}
      </ol>

      {canAdd && (
        <div className="space-y-3 border-t border-line p-5">
          <Textarea
            placeholder="What did you do on-site? Any issues?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[90px]"
          />
          <NoteImagePicker images={images} onChange={setImages} />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={draft.trim().length < 2}
              loading={busy}
              onClick={onAdd}
            >
              Save note
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerSignBox({
  defaultName,
  busy,
  onSubmit,
}: {
  defaultName: string;
  busy: boolean;
  onSubmit: (blob: Blob, name: string) => void | Promise<void>;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [name, setName] = useState(defaultName ?? "");

  const submit = async () => {
    const blob = await padRef.current?.getBlob();
    if (!blob) return;
    await onSubmit(blob, name.trim());
    padRef.current?.clear();
  };

  return (
    <div className="mt-5 border-t border-line pt-5">
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] text-ink transition-all hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          placeholder="Full name"
        />
      </div>
      <div className="mt-3">
        <SignaturePad ref={padRef} onChangeIsEmpty={setEmpty} height={160} />
      </div>
      <Button
        type="button"
        variant="primary"
        size="md"
        disabled={empty || name.trim().length < 2}
        loading={busy}
        onClick={submit}
        className="mt-3 w-full"
      >
        Submit customer signature
      </Button>
    </div>
  );
}

function EngineerSignBox({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (blob: Blob) => void | Promise<void>;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);

  const submit = async () => {
    const blob = await padRef.current?.getBlob();
    if (!blob) return;
    await onSubmit(blob);
    padRef.current?.clear();
  };

  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
        Step 2 · Your countersignature
      </p>
      <p className="mt-1 text-[12.5px] text-ink-muted">
        Signing closes the installation and generates the PDF.
      </p>
      <div className="mt-3">
        <SignaturePad ref={padRef} onChangeIsEmpty={setEmpty} height={160} />
      </div>
      <Button
        type="button"
        variant="primary"
        size="md"
        disabled={empty}
        loading={busy}
        onClick={submit}
        className="mt-3 w-full"
      >
        Sign &amp; close
      </Button>
    </div>
  );
}

function Timeline({ events }: { events: InstallEvent[] }) {
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
              <p className="text-[13px] text-ink">{labelForEvent(e)}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-subtle">
                {fmtIst(e.created_at)}
                {e.actor && <> · by {e.actor.name} ({e.actor.role.toLowerCase()})</>}
              </p>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}

function labelForEvent(e: InstallEvent): string {
  switch (e.event_type) {
    case "CREATED": return "Installation created";
    case "ASSIGNED":
      return `Assigned to ${(e.payload as { engineer_name?: string } | null)?.engineer_name ?? "engineer"}`;
    case "REASSIGNED":
      return `Reassigned to ${(e.payload as { engineer_name?: string } | null)?.engineer_name ?? "engineer"}`;
    case "NOTE_ADDED": return "Note added";
    case "COMPLETED": return "Marked complete — awaiting signatures";
    case "CUSTOMER_SIGNED": return "Customer signed";
    case "ENGINEER_SIGNED": return "Engineer signed";
    case "CLOSED": return "Closed";
    default: return e.event_type;
  }
}
