"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { Input, Label } from "@/components/ui/Field";
import { useAuth, API_BASE_URL, isAdminLevel } from "@/lib/auth";

type RosterRow = {
  id: number;
  name: string;
  phone: string;
  district: string;
  active: boolean;
  created_at: string;
};

export default function SubEngineerRosterPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (!isAdminLevel(user.role)) router.replace("/admin/tickets");
  }, [ready, user, router]);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/sub-engineer-roster?include_inactive=true`
      );
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error(`Server ${res.status}`);
      setRows((await res.json()) as RosterRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [authFetch, router]);

  useEffect(() => {
    if (isAdminLevel(user?.role)) fetchRoster();
  }, [user, fetchRoster]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFlash(null);

    if (name.trim().length < 2 || phone.trim().length < 7 || district.trim().length < 2) {
      setFormError("Enter a name, a valid phone number, and a district.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/sub-engineer-roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          district: district.trim(),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let detail = `Server ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed.detail === "string") detail = parsed.detail;
          else if (Array.isArray(parsed.detail)) {
            detail = parsed.detail.map((d: { msg?: string }) => d.msg ?? "Invalid input").join("; ");
          }
        } catch {}
        throw new Error(detail);
      }
      const body = (await res.json()) as RosterRow;
      setFlash(`Added ${body.name} to the ${body.district} roster.`);
      setName("");
      setPhone("");
      setDistrict("");
      fetchRoster();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to add contact");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (r: RosterRow) => {
    setBusyId(r.id);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/sub-engineer-roster/${r.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !r.active }),
        }
      );
      if (res.ok) fetchRoster();
    } finally {
      setBusyId(null);
    }
  };

  if (!ready || !user || !isAdminLevel(user.role)) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
            Settings · Sub-engineers
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
            Sub-engineer roster
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Field contractors organised by district. When a ticket is raised in a
            district, its contacts appear in that ticket&apos;s &ldquo;Add
            sub-engineer&rdquo; dropdown.
          </p>
        </div>

        {/* Add contact form */}
        <div className="mt-8 rounded-xl2 border border-line bg-white p-6 shadow-soft">
          <h2 className="text-[15px] font-medium text-ink">Add a contact</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            The district should match the city tickets are raised from.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="se_name" required>Name</Label>
              <Input
                id="se_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="off"
                placeholder="Full name"
              />
            </div>
            <div>
              <Label htmlFor="se_phone" required>Phone</Label>
              <Input
                id="se_phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <Label htmlFor="se_district" required>District</Label>
              <Input
                id="se_district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                required
                autoComplete="off"
                placeholder="e.g. Mysuru"
                maxLength={80}
              />
            </div>

            {formError && (
              <div className="md:col-span-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
                {formError}
              </div>
            )}
            {flash && (
              <div className="md:col-span-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
                {flash}
              </div>
            )}

            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl2 bg-ink px-6 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
              >
                {submitting ? "Adding…" : "Add contact"}
              </button>
            </div>
          </form>
        </div>

        {/* Roster table */}
        <div className="mt-10">
          <h2 className="text-[15px] font-medium text-ink">All contacts</h2>
          <div className="mt-4 overflow-x-auto rounded-xl2 border border-line shadow-soft">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead className="bg-surface-raised">
                <tr className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>District</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-subtle">Loading…</td></tr>
                ) : error ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-red-600">{error}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-subtle">No roster contacts yet.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className={r.active ? "" : "opacity-60"}>
                      <Td><span className="text-ink">{r.name}</span></Td>
                      <Td>{r.phone}</Td>
                      <Td>{r.district}</Td>
                      <Td>
                        {r.active ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] text-neutral-600">
                            Inactive
                          </span>
                        )}
                      </Td>
                      <Td>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => toggleActive(r)}
                          className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] text-ink hover:border-ink hover:bg-surface-raised transition-colors disabled:opacity-50"
                        >
                          {r.active ? "Deactivate" : "Activate"}
                        </button>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3.5 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 align-top">{children}</td>;
}
