import Link from "next/link";
import { Button } from "@/components/ui/Button";

type SearchParams = { ref?: string; email?: string };

export const metadata = {
  title: "Ticket submitted — ArcksCare",
};

// Next.js 15+ made `searchParams` a Promise. Await it before accessing values.
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const ref = (sp.ref || "").trim();
  const email = (sp.email || "").trim();

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6">
        <header className="flex items-center justify-between py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-ink" />
            <span className="font-display text-[22px] font-semibold tracking-tight text-ink">
              ArcksCare
            </span>
          </Link>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-16 text-center animate-rise-in">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-full border border-line">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12.5l4.5 4.5L20 6.5" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
            Received
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium leading-[1.05] tracking-tightest text-ink md:text-6xl">
            We&apos;ve got it from here.
          </h1>

          {ref && (
            <p className="mt-6 text-[15px] text-ink-muted">
              Your reference:{" "}
              <span className="rounded-md border border-line bg-surface-raised px-2.5 py-1 font-mono text-[14px] text-ink">
                {ref}
              </span>
            </p>
          )}

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-muted">
            {email
              ? <>A copy will reach you at <strong className="text-ink">{email}</strong>. </>
              : null}
            A specialist will be in touch shortly. You can also raise another
            ticket below if needed.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/raise-ticket">
              <Button variant="outline" size="md">Raise another ticket</Button>
            </Link>
            <Link href="/">
              <Button variant="primary" size="md">Back home</Button>
            </Link>
          </div>
        </section>

        <footer className="py-6 text-center text-[12px] text-ink-subtle">
          © {new Date().getFullYear()} ArcksCare
        </footer>
      </div>
    </main>
  );
}
