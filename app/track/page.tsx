"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { BrandMark } from "@/components/brand-mark";

// Backend (app/utils/ticket_id.py) prefixes references with the customer's
// state code — KA, TN, MH, TG, AP, … — falling back to "AC" only when the
// state is missing or unknown. So accept any 2-letter prefix here.
const REFERENCE_RE = /^[A-Z]{2}-\d{4}-\d{4,6}$/i;

export default function TrackPage() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = reference.trim().toUpperCase();
    if (!cleaned) {
      setError("Enter your ticket reference.");
      return;
    }
    if (!REFERENCE_RE.test(cleaned)) {
      setError("That doesn't look like a reference. They look like KA-2026-00042.");
      return;
    }
    router.push(`/track/${encodeURIComponent(cleaned)}`);
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-[22px] font-semibold tracking-tight text-ink">
              SK-POS Support
            </span>
          </Link>
          <Link
            href="/"
            className="hidden sm:inline-block text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            ← Back home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-6 pt-20 pb-32 md:pt-28">
        <p className="mb-5 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
          Track your ticket
        </p>
        <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tightest text-ink md:text-5xl">
          Where&apos;s my ticket?
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
          Enter the reference we sent when you raised the ticket — looks like{" "}
          <span className="font-mono text-ink">AC-2026-00042</span>.
        </p>

        <form onSubmit={submit} className="mt-10 flex flex-col gap-4">
          <div>
            <Label htmlFor="reference" required>
              Ticket reference
            </Label>
            <Input
              id="reference"
              name="reference"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                if (error) setError(null);
              }}
              placeholder="AC-2026-00042"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono uppercase tracking-wider"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-[13px] text-accent-danger">{error}</p>
            )}
          </div>

          <div>
            <Button type="submit" size="lg">
              Track ticket
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
        </form>

        <p className="mt-12 text-[13px] text-ink-subtle">
          Lost your reference? It&apos;s in the confirmation email we sent to the
          address you provided when raising the ticket.
        </p>
      </section>
    </main>
  );
}
