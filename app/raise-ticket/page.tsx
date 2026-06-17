import Link from "next/link";
import { TicketForm } from "@/components/ticket-form";
import { Wordmark } from "@/components/wordmark";

export const metadata = {
  title: "Raise a ticket — SK-POS Care",
  description:
    "Submit a support request for your hardware. A specialist will respond shortly.",
};

export default function RaiseTicketPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/admin/login"
              className="hidden sm:inline-block text-[13px] text-ink-muted hover:text-ink transition-colors"
            >
              Admin login
            </Link>
            <Link
              href="/"
              className="hidden sm:inline-block text-[13px] text-ink-muted hover:text-ink transition-colors"
            >
              ← Back home
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-16 md:py-20">
        <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
          New Support Request
        </p>
        <h1 className="mt-3 font-display text-5xl font-medium leading-[1.05] tracking-tightest text-ink md:text-6xl">
          Let&apos;s sort this out.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-muted">
          Fill in the details below. We&apos;ll triage your request and a
          specialist will reach out by your preferred channel.
        </p>

        <div className="mt-14">
          <TicketForm />
        </div>
      </section>
    </main>
  );
}
