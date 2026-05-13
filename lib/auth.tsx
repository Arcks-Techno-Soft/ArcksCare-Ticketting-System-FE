"use client";

/**
 * Auth context for the /admin app.
 *
 * Stores the JWT in localStorage (good enough for a small internal admin;
 * if we later need stricter security we can move to httpOnly cookies).
 * Wraps the app in <AuthProvider> at /admin/layout.tsx so child pages can
 * call useAuth() to read user / log out.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STORAGE_KEY = "arckscare.auth";

export type AuthUser = {
  id: number;
  username: string;
  name: string;
  role: "OWNER" | "MANAGER" | "ENGINEER";
  active: boolean;
  email?: string | null;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: AuthUser;
};

type StoredAuth = {
  token: string;
  expires_at: string;
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on first mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as StoredAuth;
        // Drop expired tokens
        if (new Date(parsed.expires_at).getTime() > Date.now()) {
          setAuth(parsed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // ignore corrupt storage
    }
    setReady(true);
  }, []);

  const persist = (next: StoredAuth | null) => {
    setAuth(next);
    if (typeof window === "undefined") return;
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (res.status === 401) {
          return { ok: false as const, error: "Invalid username or password" };
        }
        if (!res.ok) {
          const t = await res.text();
          return { ok: false as const, error: `Server error: ${t.slice(0, 200)}` };
        }
        const data = (await res.json()) as LoginResponse;
        persist({ token: data.access_token, expires_at: data.expires_at, user: data.user });
        return { ok: true as const };
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : "Network error",
        };
      }
    },
    []
  );

  const logout = useCallback(() => persist(null), []);

  const authFetch: AuthContextValue["authFetch"] = useCallback(
    async (input, init = {}) => {
      const headers = new Headers(init.headers);
      if (auth?.token) headers.set("Authorization", `Bearer ${auth.token}`);
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        // Token rejected/expired - clear it so the layout sends to login
        persist(null);
      }
      return res;
    },
    [auth]
  );

  return (
    <AuthContext.Provider
      value={{ user: auth?.user ?? null, token: auth?.token ?? null, ready, login, logout, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Convenience export used by pages that don't want to call useAuth(). */
export const API_BASE_URL = API_BASE;
