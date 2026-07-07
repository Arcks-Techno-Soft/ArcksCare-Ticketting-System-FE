"use client";

import { useEffect, useRef, useState } from "react";

import type { BusinessSuggestion } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Debounced suggestion fetching + keyboard/open state for a business-name
 * input. Each suggestion carries a category, so `onPick` hands the whole
 * object back and the form can fill both the name and its business type.
 *
 * Waits 300ms after the user stops typing and needs at least 2 characters
 * before hitting the server, so a typical form fill costs 1-3 requests, not
 * one per keystroke. Suggestions whose name exactly matches the current text
 * are dropped — that's also what closes the list right after a pick.
 */
export function useAutocomplete(
  query: string,
  fetchSuggestions: ((q: string) => Promise<BusinessSuggestion[]>) | undefined,
  onPick: (suggestion: BusinessSuggestion) => void
) {
  const [suggestions, setSuggestions] = useState<BusinessSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Callers pass inline arrows, so hold the fetcher in a ref — otherwise its
  // fresh identity on every render would re-arm the debounce effect in a loop.
  const fetchRef = useRef(fetchSuggestions);
  useEffect(() => {
    fetchRef.current = fetchSuggestions;
  });
  const enabled = !!fetchSuggestions;

  useEffect(() => {
    if (!enabled) return;
    const q = query?.trim() ?? "";
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      fetchRef.current?.(q)
        .then((hits) => {
          if (stale) return;
          setSuggestions(
            hits.filter((h) => h.business_name.toLowerCase() !== q.toLowerCase())
          );
          setOpen(true);
        })
        .catch(() => {
          // Suggestions are a convenience — a failed lookup must never block typing.
          if (!stale) setSuggestions([]);
        });
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, enabled]);

  useEffect(() => setActiveIndex(-1), [suggestions]);

  const visible = open && suggestions.length > 0;

  const pick = (suggestion: BusinessSuggestion) => {
    setOpen(false);
    onPick(suggestion);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!visible) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      // Swallow Enter so picking a suggestion doesn't submit the form.
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return { suggestions, visible, setOpen, activeIndex, pick, onKeyDown };
}

/** Dropdown list rendered under the input. Wrap the input in a `relative` container. */
export function SuggestionList({
  suggestions,
  visible,
  activeIndex,
  onPick,
}: {
  suggestions: BusinessSuggestion[];
  visible: boolean;
  activeIndex: number;
  onPick: (suggestion: BusinessSuggestion) => void;
}) {
  if (!visible) return null;
  return (
    <ul
      role="listbox"
      className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl2 border border-line bg-white shadow-soft"
    >
      {suggestions.map((s, i) => (
        <li key={s.business_name} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            // onMouseDown (not onClick) so the pick lands before the input blurs.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(s);
            }}
            className={cn(
              "flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-raised",
              i === activeIndex && "bg-surface-raised"
            )}
          >
            <span className="text-[15px] text-ink">{s.business_name}</span>
            {s.business_type && (
              <span className="shrink-0 text-[12px] text-ink-subtle">{s.business_type}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
