"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/brand-mark";
import {
  FieldError,
  FieldGroup,
  Input,
  Label,
} from "@/components/ui/Field";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await login(username.trim(), password);
    setSubmitting(false);
    if (res.ok) {
      router.replace("/admin/tickets");
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(0,0,0,0.04),transparent_70%)]"
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[20px] font-semibold tracking-tight text-ink">
              SK-POS Care
            </span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              Admin
            </span>
          </div>
        </Link>
        <Link
          href="/"
          className="text-[13px] text-ink-muted hover:text-ink transition-colors"
        >
          ← Back to customer site
        </Link>
      </header>

      <div className="mx-auto flex max-w-md flex-col px-6 pt-12 pb-24">
        <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
          Internal access
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium leading-[1.1] tracking-tightest text-ink md:text-5xl">
          Sign in to admin.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">
          For Admin, Manager, and Engineer accounts. Customer ticket
          submissions don&apos;t need a login.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <FieldGroup>
            <Label htmlFor="username" required>Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="owner"
              autoComplete="username"
              autoFocus
              required
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="password" required>Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </FieldGroup>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl2 border border-accent-danger/30 bg-white p-3.5 text-[13px] text-accent-danger"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            className="w-full"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-10 text-[12px] text-ink-subtle">
          Dev defaults: <code className="font-mono">owner / owner123</code> (Admin) ·{" "}
          <code className="font-mono">admin / admin123</code> (Manager).
          Change these in <code className="font-mono">backend/.env</code> before deploying.
        </p>
      </div>
    </div>
  );
}
