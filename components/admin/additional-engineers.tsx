"use client";

/**
 * AdditionalEngineers — co-assigned app users on a ticket.
 *
 * Distinct from the SubEngineers card (non-login field contractors): these are
 * real system users (engineers/managers/admins) added to attend the SAME site
 * visit. They can view the ticket and are notified, but only the PRIMARY
 * assignee drives the workflow (accept / notes / resolve).
 *
 * Only Admin/Manager/Owner can add or remove; the picker excludes the primary
 * assignee and anyone already added.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { EngineerPicker, type Engineer } from "@/components/admin/engineer-picker";

export type AdditionalEngineer = {
  id: number;
  engineer: Engineer;
  added_by?: { id: number; name: string; role: string } | null;
  added_at: string;
};

type Props = {
  items: AdditionalEngineer[];
  /** Full active-engineer list to pick from. */
  engineers: Engineer[];
  /** Primary assignee id — excluded from the add picker. */
  primaryId: number | null;
  canManage: boolean;
  busy: boolean;
  /** Ticket city — surfaces engineers in that district first. */
  matchDistrict?: string | null;
  onAdd: (engineerId: number) => Promise<void> | void;
  onRemove: (engineerId: number) => Promise<void> | void;
  error: string | null;
};

export function AdditionalEngineers({
  items,
  engineers,
  primaryId,
  canManage,
  busy,
  matchDistrict,
  onAdd,
  onRemove,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  // Hide the primary assignee and anyone already co-assigned from the picker.
  const takenIds = new Set<number>(items.map((i) => i.engineer.id));
  if (primaryId != null) takenIds.add(primaryId);
  const selectable = engineers.filter((e) => !takenIds.has(e.id));

  const submit = async () => {
    if (picked == null) return;
    await onAdd(picked);
    setPicked(null);
    setOpen(false);
  };

  return (
    <div className="rounded-xl2 border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          Co-assigned engineers
        </span>
        <span className="text-[11px] text-ink-subtle">
          {items.length} {items.length === 1 ? "person" : "people"}
        </span>
      </div>

      <ul className="divide-y divide-line/60">
        {items.length === 0 ? (
          <li className="px-5 py-4 text-[13px] text-ink-subtle">
            No co-assigned engineers. Add another app user when two engineers
            need to attend the same visit.
          </li>
        ) : (
          items.map((it) => (
            <li key={it.id} className="flex items-center justify-between px-5 py-3">
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-[11px] font-medium text-ink">
                  {it.engineer.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13.5px] font-medium text-ink">
                    {it.engineer.name}
                  </span>
                  <span className="text-[11.5px] text-ink-subtle">
                    @{it.engineer.username}
                    {it.engineer.district ? ` · ${it.engineer.district}` : ""}
                  </span>
                </span>
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onRemove(it.engineer.id)}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-[12.5px] text-ink-muted hover:text-red-600 transition-colors disabled:opacity-50"
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
            {!open ? (
              <motion.div
                key="trigger"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  disabled={selectable.length === 0}
                  className="block w-full px-5 py-3.5 text-left text-[13.5px] text-ink hover:bg-surface-raised transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectable.length === 0
                    ? "No other engineers available to add"
                    : "+ Add another engineer"}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                // NOTE: no overflow-hidden here — the EngineerPicker dropdown is
                // absolutely positioned and must be able to overflow the card.
              >
                <div className="space-y-3 p-5">
                  <EngineerPicker
                    engineers={selectable}
                    selectedId={picked}
                    onChange={setPicked}
                    matchDistrict={matchDistrict}
                    placeholder="Choose engineer"
                  />
                  {error && (
                    <p className="text-[12.5px] text-red-600">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      loading={busy}
                      disabled={picked == null}
                      onClick={submit}
                    >
                      Add engineer
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={() => {
                        setOpen(false);
                        setPicked(null);
                      }}
                    >
                      Cancel
                    </Button>
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
