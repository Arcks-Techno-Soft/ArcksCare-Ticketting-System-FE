"use client";

/**
 * EngineerPicker - custom combobox so engineer names render in OUR styling
 * (not the OS-native <select> popup). Built on a button + dropdown ul.
 *
 * - Shows the selected engineer's name in the trigger
 * - Closes on outside click or Escape
 * - Excludes a "skip" engineer (e.g. the currently assigned one when reassigning)
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type Engineer = {
  id: number;
  username: string;
  name: string;
  role: string;
};

type Props = {
  engineers: Engineer[];
  selectedId: number | null;
  onChange: (id: number) => void;
  /** Hide this engineer from the list (e.g. currently assigned one when reassigning). */
  excludeId?: number | null;
  placeholder?: string;
  disabled?: boolean;
};

export function EngineerPicker({
  engineers,
  selectedId,
  onChange,
  excludeId,
  placeholder = "Choose engineer",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = engineers.filter((e) => e.id !== excludeId);
  const selected = engineers.find((e) => e.id === selectedId) ?? null;
  const empty = visible.length === 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || empty}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl2 border border-line bg-white px-4 py-3 text-left text-[14px] text-ink",
          "transition-all duration-200 hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-ink"
        )}
      >
        <span className={selected ? "text-ink" : "text-ink-subtle"}>
          {empty ? "No other engineers available" : selected ? selected.name : placeholder}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
          className={cn("ml-2 text-ink-subtle transition-transform", open && "rotate-180")}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && !empty && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl2 border border-line bg-white shadow-lift"
          >
            {visible.map((e) => {
              const isSelected = e.id === selectedId;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(e.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-[14px] transition-colors",
                      isSelected ? "bg-surface-raised text-ink" : "text-ink hover:bg-surface-raised"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-[11px] font-medium text-ink">
                        {e.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium text-ink">{e.name}</span>
                      <span className="text-[12px] text-ink-subtle">@{e.username}</span>
                    </span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="text-ink">
                        <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
