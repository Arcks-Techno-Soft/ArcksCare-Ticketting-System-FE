"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Debounced suggestion fetching + keyboard/open state for a text input.
 *
 * Waits 300ms after the user stops typing and needs at least 2 characters
 * before hitting the server, so a typical form fill costs 1-3 requests, not
 * one per keystroke. Suggestions that exactly match the current text are
 * dropped — that's also what closes the list right after a pick.
 */
export function useAutocomplete(
  query: string,
  fetchSuggestions: ((q: string) => Promise<string[]>) | undefined,
  onPick: (name: string) => void
) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
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
        .then((names) => {
          if (stale) return;
          setSuggestions(names.filter((n) => n.toLowerCase() !== q.toLowerCase()));
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

  const pick = (name: string) => {
    setOpen(false);
    onPick(name);
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
  suggestions: string[];
  visible: boolean;
  activeIndex: number;
  onPick: (name: string) => void;
}) {
  if (!visible) return null;
  return (
    <ul
      role="listbox"
      className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl2 border border-line bg-white shadow-soft"
    >
      {suggestions.map((name, i) => (
        <li key={name} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            // onMouseDown (not onClick) so the pick lands before the input blurs.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(name);
            }}
            className={cn(
              "w-full px-4 py-2.5 text-left text-[15px] text-ink transition-colors hover:bg-surface-raised",
              i === activeIndex && "bg-surface-raised"
            )}
          >
            {name}
          </button>
        </li>
      ))}
    </ul>
  );
}
