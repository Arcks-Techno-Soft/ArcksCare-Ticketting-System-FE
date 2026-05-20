"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { Input, Label, Select } from "@/components/ui/Field";
import { useAuth, API_BASE_URL } from "@/lib/auth";

// Mirrors the backend's username validator: 3-50 chars, lowercase alnum
// plus dot/underscore/hyphen. Client-side check is just for fast feedback —
// the server is the source of truth and rejects anything that doesn't match.
const USERNAME_RE = /^[a-z0-9._-]{3,50}$/;
const PASSWORD_MIN = 8;

type UserRow = {
  id: number;
  username: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  role: "OWNER" | "MANAGER" | "ENGINEER";
  district?: string | null;
  active: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Admin",
  ENGINEER: "Engineer",
};

const ROLE_OPTIONS = ["Admin", "Engineer"] as const;
const ROLE_VALUES: Record<(typeof ROLE_OPTIONS)[number], "MANAGER" | "ENGINEER"> = {
  Admin: "MANAGER",
  Engineer: "ENGINEER",
};

export default function UsersPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state — owner picks username + password explicitly. Auto-
  // generation is gone, so these two are required and validated locally.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("Engineer");
  const [district, setDistrict] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Success flash — replaces the old "temporary password" modal since the
  // owner already knows the password they typed in.
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (user.role !== "OWNER") router.replace("/admin/tickets");
  }, [ready, user, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/users`);
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error(`Server ${res.status}`);
      setUsers((await res.json()) as UserRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [authFetch, router]);

  useEffect(() => {
    if (user?.role === "OWNER") fetchUsers();
  }, [user, fetchUsers]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFlash(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_RE.test(cleanUsername)) {
      setFormError("Username must be 3–50 characters using lowercase letters, digits, dot, underscore or hyphen.");
      setSubmitting(false);
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setFormError(`Password must be at least ${PASSWORD_MIN} characters.`);
      setSubmitting(false);
      return;
    }
    if (role === "Engineer" && !district.trim()) {
      setFormError("Enter the district this engineer covers.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          username: cleanUsername,
          password,
          role: ROLE_VALUES[role],
          district: role === "Engineer" ? district.trim() : null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let detail = `Server ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          // FastAPI 422 returns detail as an array of validation errors;
          // collapse it to a single line so the user sees something useful.
          if (typeof parsed.detail === "string") detail = parsed.detail;
          else if (Array.isArray(parsed.detail)) {
            detail = parsed.detail.map((d: { msg?: string }) => d.msg ?? "Invalid input").join("; ");
          }
        } catch {}
        throw new Error(detail);
      }
      const body = (await res.json()) as { user: UserRow };
      setFlash(`Created ${body.user.name} (${body.user.username}). They can sign in now.`);
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setUsername("");
      setPassword("");
      setShowPassword(false);
      setRole("Engineer");
      setDistrict("");
      fetchUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    const res = await authFetch(`${API_BASE_URL}/api/v1/admin/users/${u.id}/active`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (res.ok) fetchUsers();
  };

  if (!ready || !user || user.role !== "OWNER") return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="border-b border-line pb-6">
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
            Settings · Users
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
            Users &amp; roles
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Owner-only. You choose the username and password — they take effect immediately.
          </p>
        </div>

        {/* Create user form */}
        <div className="mt-8 rounded-xl2 border border-line bg-white p-6 shadow-soft">
          <h2 className="text-[15px] font-medium text-ink">Add a new user</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Pick a unique username. Share the password with the new user privately.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="firstName" required>First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="lastName" required>Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="phone" required>Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
              />
            </div>
            <div>
              <Label htmlFor="username" required>Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
                autoComplete="off"
                placeholder="e.g. priya.iyer"
                minLength={3}
                maxLength={50}
                pattern="[a-z0-9._-]+"
              />
              <p className="mt-1 text-[11.5px] text-ink-subtle">
                Lowercase letters, digits, <code>.</code> <code>_</code> <code>-</code>. Must be unique.
              </p>
            </div>
            <div>
              <Label htmlFor="password" required>Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN}
                  placeholder={`At least ${PASSWORD_MIN} characters`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-3 flex items-center text-ink-subtle hover:text-ink"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="mt-1 text-[11.5px] text-ink-subtle">
                Share this with the user out-of-band (Signal/WhatsApp, not email).
              </p>
            </div>
            <div className={role === "Engineer" ? "" : "md:col-span-2"}>
              <Label htmlFor="role" required>Role</Label>
              <Select
                id="role"
                options={ROLE_OPTIONS}
                value={role}
                onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number])}
              />
            </div>
            {role === "Engineer" && (
              <div>
                <Label htmlFor="district" required>District</Label>
                <Input
                  id="district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="e.g. Mysuru"
                  maxLength={80}
                />
                <p className="mt-1 text-[11.5px] text-ink-subtle">
                  District this engineer covers. Tickets from a matching city
                  list this engineer first when assigning.
                </p>
              </div>
            )}

            {formError && (
              <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
                {formError}
              </div>
            )}
            {flash && (
              <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
                {flash}
              </div>
            )}

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl2 bg-ink px-6 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create user"}
              </button>
            </div>
          </form>
        </div>

        {/* Users table */}
        <div className="mt-10">
          <h2 className="text-[15px] font-medium text-ink">All users</h2>
          <div className="mt-4 overflow-hidden rounded-xl2 border border-line shadow-soft">
            <table className="w-full text-left text-[13.5px]">
              <thead className="bg-surface-raised">
                <tr className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                  <Th>Name</Th>
                  <Th>Username</Th>
                  <Th>Role</Th>
                  <Th>District</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-ink-subtle">Loading…</td></tr>
                ) : error ? (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-red-600">{error}</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-ink-subtle">No users yet.</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                      <Td>
                        <div className="text-ink">{u.name}</div>
                      </Td>
                      <Td><span className="font-mono text-[12.5px]">{u.username}</span></Td>
                      <Td>
                        <span className="inline-flex items-center rounded-full border border-line bg-white px-2.5 py-0.5 text-[11.5px]">
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </Td>
                      <Td>{u.district || "—"}</Td>
                      <Td>{u.phone || "—"}</Td>
                      <Td>{u.email || "—"}</Td>
                      <Td>
                        {u.active ? (
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
                        {user.id !== u.id && u.role !== "OWNER" && (
                          <button
                            type="button"
                            onClick={() => toggleActive(u)}
                            className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                        )}
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
