import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      {/* Subtle gradient wash, kept very faint to preserve "pure white" feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 grain opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(0,0,0,0.04),transparent_70%)]"
      />

      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-ink" />
          <span className="font-display text-[22px] font-semibold tracking-tight text-ink">
            SK-POS Care
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/admin/login"
            className="text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            Admin login
          </Link>
          <Link href="/raise-ticket">
            <Button variant="primary" size="md">
              Raise a ticket
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <p className="mb-5 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
          Hardware Support, Refined
        </p>
        <h1 className="font-display text-balance text-5xl font-medium leading-[1.05] tracking-tightest text-ink md:text-7xl">
          A calmer way to <span className="italic">resolve</span> your
          <br className="hidden md:block" /> hardware issues.
        </h1>
        <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink-muted">
          Tell us what&apos;s wrong with your POS, printer, kitchen display, UPS
          or CCTV — and a specialist will reach out. No phone trees, no
          back-and-forth.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/raise-ticket">
            <Button variant="primary" size="lg">
              Raise a ticket
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </Link>
          <span className="text-[13px] text-ink-subtle">
            Typically responded to within a few hours
          </span>
        </div>

        {/* Feature row */}
        <div className="mt-24 grid gap-10 border-t border-line pt-12 md:grid-cols-3">
          {[
            {
              k: "01",
              t: "Serial-first intake",
              d: "Your device's serial number is all we need to pull up your records.",
            },
            {
              k: "02",
              t: "One ticket per device",
              d: "We prevent duplicate tickets so your team isn't burned by churn.",
            },
            {
              k: "03",
              t: "Direct line to support",
              d: "Every submission lands directly with our hardware specialists.",
            },
          ].map((item) => (
            <div key={item.k}>
              <div className="text-[12px] tracking-[0.18em] text-ink-subtle">
                {item.k}
              </div>
              <h3 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
                {item.t}
              </h3>
              <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-ink-muted">
                {item.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-[12px] text-ink-subtle">
          <span>© {new Date().getFullYear()} SK-POS Care</span>
          <span>Made for restaurants, hotels, retail & cloud kitchens</span>
        </div>
      </footer>
    </main>
  );
}
