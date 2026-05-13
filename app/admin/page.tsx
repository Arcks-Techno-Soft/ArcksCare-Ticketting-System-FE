"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AdminIndex() {
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? "/admin/tickets" : "/admin/login");
  }, [ready, user, router]);

  return null;
}
