"use client";

/**
 * SubEngineers section — list + add form for ad-hoc field contractors on a
 * ticket. The main assignee remains responsible for work-note updates;
 * sub-engineers are just contact records.
 *
 * When the user clicks "Add a sub-engineer", we first show contacts previously
 * used in this ticket's city. Picking one re-uses those details for a single
 * click add; "Add someone new" reveals the manual form.
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
  created_at: string;
  created_by?: { id: number; name: string; role: string; username: string } | null;
};

export type SubEngineerSuggestion = {
  name: string;
  phone: string;
  location: string;
  times_used: number;
  last_used_at: string;
};

type Props = {
  items: SubEngineer[];
  canManage: boolean;
  defaultLocation: string;
  busy: boolean;
  suggestions: SubEngineerSuggestion[];
  suggestionsLoading?: boolean;
  onAdd: (input: { name: string; phone: string; location: string }) => Promise<void> | void;
  onRemove: (id: number) => Promise<void> | void;
  error: string | null;
};

type Mode = "closed" | "pick" | "new";

export function SubEngineers({
  items,
  canManage,
  defaultLocation,
  busy,
  suggestions,
  suggestionsLoading = false,
  onAdd,
  onRemove,
  error,
}: Props) {
  const [mode, setMode] = useState<Mode>("closed");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState(defaultLocation);
  const [pickedKey, setPickedKey] = useState<string>("");

  // Keep the manual form's default city in sync if the ticket changes
  useEffect(() => {
    if (mode === "closed") setLocation(defaultLocation);
  }, [defaultLocation, mode]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setLocation(defaultLocation);
    setPickedKey("");
  };

  const close = () => {
    setMode("closed");
    resetForm();
  };

  const pickedSuggestion = useMemo(
    () => suggestions.find((s) => keyOf(s) === pickedKey) ?? null,
    [pickedKey, suggestions]
  );

  const submitPicked = async () => {
    if (!pickedSuggestion) return;
    await onAdd({
      name: pickedSuggestion.name.trim(),
      phone: pickedSuggestion.phone.trim(),
      // Re-use stored location, but fall back to the ticket city if blank.
      location: (pickedSuggestion.location || defaultLocation).trim(),
    });
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
            <li key={s.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">{s.name}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  <a className="hover:underline" href={`tel:${s.phone}`}>{s.phone}</a>
                  <span className="mx-1.5 text-ink-subtle">·</span>
                  {s.location}
                </p>
                {s.created_by && (
                  <p className="mt-0.5 text-[11.5px] text-ink-subtle">
                    Added by {s.created_by.name} ({s.created_by.role.toLowerCase()})
                  </p>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(s.id)}
                  className="rounded-md px-2 py-1 text-[12px] text-ink-subtle hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-40"
                  aria-label={`Remove ${s.name}`}
                  title="Remove"
                >
                  Remove
                </button>
              )}
            </li>
          ))
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
                    // Default to the picker when we have suggestions to show;
                    // otherwise jump straight to the manual form.
                    setMode(suggestions.length > 0 ? "pick" : "new");
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
                      Previously used in {defaultLocation || "this city"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-subtle">
                      Pick a contact to re-use, or add someone new.
                    </p>
                  </div>

                  {suggestionsLoading ? (
                    <div className="rounded-md border border-line bg-surface-raised px-3 py-3 text-[12.5px] text-ink-subtle">
                      Loading suggestions…
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="rounded-md border border-dashed border-line bg-surface-raised px-3 py-3 text-[12.5px] text-ink-subtle">
                      No previous sub-engineers in this city yet.
                    </div>
                  ) : (
                    <FieldGroup>
                      <Label htmlFor="se_pick">Sub-engineer</Label>
                      <select
                        id="se_pick"
                        value={pickedKey}
                        onChange={(e) => setPickedKey(e.target.value)}
                        className="w-full rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] text-ink
                                   transition-all hover:border-line-strong focus:border-ink focus:outline-none
                                   focus:ring-2 focus:ring-ink/10"
                      >
                        <option value="">Select a contact…</option>
                        {suggestions.map((s) => (
                          <option key={keyOf(s)} value={keyOf(s)}>
                            {s.name} — {s.phone}
                            {s.times_used > 1 ? ` · used ${s.times_used}×` : ""}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>
                  )}

                  {pickedSuggestion && (
                    <div className="rounded-md border border-line bg-surface-raised px-3 py-2.5">
                      <p className="text-[13.5px] font-medium text-ink">
                        {pickedSuggestion.name}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">
                        {pickedSuggestion.phone}
                        <span className="mx-1.5 text-ink-subtle">·</span>
                        {pickedSuggestion.location}
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
                        disabled={!pickedSuggestion}
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
                      Location
                    </Label>
                    <Input
                      id="se_location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City / area"
                    />
                  </FieldGroup>

                  <FieldError message={error ?? undefined} />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {suggestions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("pick");
                          resetForm();
                        }}
                        className="text-[12.5px] text-ink-muted hover:text-ink transition-colors"
                      >
                        ← Pick from previous
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

function keyOf(s: { name: string; phone: string }): string {
  return `${s.name.trim().toLowerCase()}|${s.phone.trim()}`;
}
