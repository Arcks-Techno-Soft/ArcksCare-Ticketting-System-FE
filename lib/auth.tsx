"use client";

/**
 * Auth context for the /admin app.
 *
 * Stores the JWT in sessionStorage so each browser tab has its own session.
 * This lets operators sign in as different roles in different tabs (e.g.
 * owner in one, manager in another) without one tab's login overwriting the
 * other's via shared localStorage.
 *
 * Tradeoff: closing the tab clears the session. For an internal admin tool
 * that's a reasonable default — the JWT also expires server-side, so users
 * already had to log in periodically.
 *
 * A legacy localStorage entry (from the previous build) is migrated into
 * the current tab's sessionStorage on first hydrate, then deleted, so
 * already-signed-in users aren't kicked out by this change.
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
const STORAGE_KEY = "sk-pos-care.auth";

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

  // Hydrate from sessionStorage on first mount. If a legacy localStorage
  // entry exists (older build used localStorage), pull it into this tab's
  // sessionStorage and clear it — so this change doesn't sign anyone out
  // and existing tabs migrate cleanly on first refresh.
  useEffect(() => {
    if (typeof window === "undefined") {
      setReady(true);
      return;
    }
    try {
      let raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem(STORAGE_KEY);
        if (legacy) {
          sessionStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(STORAGE_KEY);
          raw = legacy;
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as StoredAuth;
        if (new Date(parsed.expires_at).getTime() > Date.now()) {
          setAuth(parsed);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
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
    if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(STORAGE_KEY);
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
