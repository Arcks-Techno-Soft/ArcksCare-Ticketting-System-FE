"use client";

/**
 * SubEngineers section — list + add form for field contractors on a ticket.
 * The main assignee remains responsible for work-note updates; sub-engineers
 * are contact records.
 *
 * Adding a sub-engineer: pick from the district roster (contacts known for
 * this ticket's city), or add someone new — a new contact also joins the
 * roster so it's reusable on future tickets.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { FieldGroup, FieldError, Input, Label } from "@/components/ui/Field";

export type SubEngineer = {
  id: number;
  name: string;
  phone: string;
  location: string;
  fee_inr?: number | null;
  created_at: string;
  created_by?: { id: number; name: string; role: string; username: string } | null;
};

/** A contact from the district roster — feeds the add dropdown. */
export type RosterContact = {
  id: number;
  name: string;
  phone: string;
  district: string;
};

export type AddSubEngineerInput = {
  roster_id?: number;
  name?: string;
  phone?: string;
  location?: string;
};

type Props = {
  items: SubEngineer[];
  canManage: boolean;
  defaultLocation: string;
  busy: boolean;
  roster: RosterContact[];
  rosterLoading?: boolean;
  onAdd: (input: AddSubEngineerInput) => Promise<void> | void;
  onRemove: (id: number) => Promise<void> | void;
  onSetFee: (id: number, fee: number) => Promise<void> | void;
  error: string | null;
};

type Mode = "closed" | "pick" | "new";

export function SubEngineers({
  items,
  canManage,
  defaultLocation,
  busy,
  roster,
  rosterLoading = false,
  onAdd,
  onRemove,
  onSetFee,
  error,
}: Props) {
  const [mode, setMode] = useState<Mode>("closed");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState(defaultLocation);
  const [pickedId, setPickedId] = useState<string>("");

  // Keep the manual form's default city in sync if the ticket changes
  useEffect(() => {
    if (mode === "closed") setLocation(defaultLocation);
  }, [defaultLocation, mode]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setLocation(defaultLocation);
    setPickedId("");
  };

  const close = () => {
    setMode("closed");
    resetForm();
  };

  const pickedContact = useMemo(
    () => roster.find((r) => String(r.id) === pickedId) ?? null,
    [pickedId, roster]
  );

  const submitPicked = async () => {
    if (!pickedContact) return;
    await onAdd({ roster_id: pickedContact.id });
    close();
  };

  const submitNew = async () => {
    if (name.trim().length < 2 || phone.trim().length < 7 || location.trim().length < 2) return;
    await onAdd({ name: name.trim(), phone: phone.trim(), location: location.trim() });
    close();
  };

  return (
    <div className="rounded-xl2 border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          Additional engineers
        </span>
        <span className="text-[11px] text-ink-subtle">
          {items.length} {items.length === 1 ? "person" : "people"}
        </span>
      </div>

      <ul className="divide-y divide-line/60">
        {items.length === 0 ? (
          <li className="px-5 py-4 text-[13px] text-ink-subtle">
            No additional engineers on this ticket.
          </li>
        ) : (
          items.map((s) => (
            <SubEngineerRow
              key={s.id}
              sub={s}
              canManage={canManage}
              busy={busy}
              onRemove={onRemove}
              onSetFee={onSetFee}
            />
          ))
        )}
        {items.length > 0 && (
          <li className="flex items-center justify-between bg-surface-raised/60 px-5 py-2.5">
            <span className="text-[11.5px] uppercase tracking-[0.12em] text-ink-subtle">
              Total outsourcing fees
            </span>
            <span className="text-[13.5px] font-medium text-ink">
              ₹{items.reduce((sum, s) => sum + (s.fee_inr ?? 0), 0).toLocaleString("en-IN")}
            </span>
          </li>
        )}
      </ul>

      {canManage && (
        <div className="border-t border-line">
          <AnimatePresence initial={false} mode="wait">
            {mode === "closed" && (
              <motion.div
                key="trigger"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    // Default to the roster picker when contacts exist;
                    // otherwise jump straight to the manual form.
                    setMode(roster.length > 0 ? "pick" : "new");
                    setLocation(defaultLocation);
                  }}
                  className="block w-full px-5 py-3.5 text-left text-[13.5px] text-ink hover:bg-surface-raised transition-colors"
                >
                  + Add a sub-engineer
                </button>
              </motion.div>
            )}

            {mode === "pick" && (
              <motion.div
                key="pick"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 p-5">
                  <div>
                    <p className="text-[12.5px] font-medium text-ink">
                      Roster for {defaultLocation || "this district"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-subtle">
                      Pick a contact from the roster, or add someone new.
                    </p>
                  </div>

                  {rosterLoading ? (
                    <div className="rounded-md border border-line bg-surface-raised px-3 py-3 text-[12.5px] text-ink-subtle">
                      Loading roster…
                    </div>
                  ) : roster.length === 0 ? (
                    <div className="rounded-md border border-dashed border-line bg-surface-raised px-3 py-3 text-[12.5px] text-ink-subtle">
                      No roster contacts for this district yet.
                    </div>
                  ) : (
                    <FieldGroup>
                      <Label htmlFor="se_pick">Sub-engineer</Label>
                      <select
                        id="se_pick"
                        value={pickedId}
                        onChange={(e) => setPickedId(e.target.value)}
                        className="w-full rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] text-ink
                                   transition-all hover:border-line-strong focus:border-ink focus:outline-none
                                   focus:ring-2 focus:ring-ink/10"
                      >
                        <option value="">Select a contact…</option>
                        {roster.map((r) => (
                          <option key={r.id} value={String(r.id)}>
                            {r.name} — {r.phone}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>
                  )}

                  {pickedContact && (
                    <div className="rounded-md border border-line bg-surface-raised px-3 py-2.5">
                      <p className="text-[13.5px] font-medium text-ink">
                        {pickedContact.name}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">
                        {pickedContact.phone}
                        <span className="mx-1.5 text-ink-subtle">·</span>
                        {pickedContact.district}
                      </p>
                    </div>
                  )}

                  <FieldError message={error ?? undefined} />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("new");
                        resetForm();
                      }}
                      className="text-[12.5px] text-ink-muted hover:text-ink transition-colors"
                    >
                      + Add someone new
                    </button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="md" onClick={close}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        loading={busy}
                        disabled={!pickedContact}
                        onClick={submitPicked}
                      >
                        Add to ticket
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {mode === "new" && (
              <motion.div
                key="new"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 p-5">
                  <p className="text-[12px] text-ink-subtle">
                    New contacts are saved to the {location || "district"} roster
                    for reuse on future tickets.
                  </p>
                  <FieldGroup>
                    <Label htmlFor="se_name" required>Name</Label>
                    <Input
                      id="se_name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label htmlFor="se_phone" required>Mobile</Label>
                    <Input
                      id="se_phone"
                      value={phone}
                      inputMode="tel"
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98xxxxxxxx"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label htmlFor="se_location" required hint="Pre-filled from ticket city">
                      District
                    </Label>
                    <Input
                      id="se_location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="District / city"
                    />
                  </FieldGroup>

                  <FieldError message={error ?? undefined} />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {roster.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("pick");
                          resetForm();
                        }}
                        className="text-[12.5px] text-ink-muted hover:text-ink transition-colors"
                      >
                        ← Pick from roster
                      </button>
                    )}
                    <div className="ml-auto flex gap-2">
                      <Button type="button" variant="outline" size="md" onClick={close}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        loading={busy}
                        disabled={
                          name.trim().length < 2 ||
                          phone.trim().length < 7 ||
                          location.trim().length < 2
                        }
                        onClick={submitNew}
                      >
                        Add engineer
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function SubEngineerRow({
  sub,
  canManage,
  busy,
  onRemove,
  onSetFee,
}: {
  sub: SubEngineer;
  canManage: boolean;
  busy: boolean;
  onRemove: (id: number) => Promise<void> | void;
  onSetFee: (id: number, fee: number) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [feeInput, setFeeInput] = useState(sub.fee_inr != null ? String(sub.fee_inr) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = Number(feeInput);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    try {
      await onSetFee(sub.id, Math.round(v));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setFeeInput(sub.fee_inr != null ? String(sub.fee_inr) : "");
    setEditing(false);
  };

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">{sub.name}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            <a className="hover:underline" href={`tel:${sub.phone}`}>{sub.phone}</a>
            <span className="mx-1.5 text-ink-subtle">·</span>
            {sub.location}
          </p>
          {sub.created_by && (
            <p className="mt-0.5 text-[11.5px] text-ink-subtle">
              Added by {sub.created_by.name} ({sub.created_by.role.toLowerCase()})
            </p>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove(sub.id)}
            className="rounded-md px-2 py-1 text-[12px] text-ink-subtle hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-40"
            aria-label={`Remove ${sub.name}`}
            title="Remove"
          >
            Remove
          </button>
        )}
      </div>

      {/* Outsourcing fee — internal cost, not part of the customer invoice */}
      <div className="mt-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-line bg-white pl-2.5 focus-within:border-ink">
              <span className="text-[13px] text-ink-subtle">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={feeInput}
                autoFocus
                onChange={(e) => setFeeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") cancel();
                }}
                placeholder="0"
                className="w-24 bg-transparent px-1.5 py-1.5 text-[13px] text-ink focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-md bg-ink px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md px-2 py-1 text-[12px] text-ink-subtle transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="text-ink-subtle">Outsourcing fee:</span>
            <span className="font-medium text-ink">
              {sub.fee_inr != null
                ? `₹${sub.fee_inr.toLocaleString("en-IN")}`
                : "Not recorded"}
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[12px] text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
              >
                {sub.fee_inr != null ? "Edit" : "Add fee"}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
