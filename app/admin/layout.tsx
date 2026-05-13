import { AuthProvider } from "@/lib/auth";
import "../globals.css";

export const metadata = {
  title: "ArcksCare — Admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <main className="min-h-screen bg-white text-ink">{children}</main>
    </AuthProvider>
  );
}
